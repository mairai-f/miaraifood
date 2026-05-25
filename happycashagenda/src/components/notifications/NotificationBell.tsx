import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { playNotificationSound } from '@/lib/notificationSound';

interface Notification {
  id: string;
  type: 'purchase' | 'appointment_scheduled' | 'appointment_cancelled';
  title: string;
  description: string;
  created_at: string;
  read: boolean;
}

type AppointmentNotificationRow = {
  id: string;
  client_name: string | null;
  appointment_date: string;
  appointment_time: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
};

type ProductOrderNotificationRow = {
  id: string;
  client_name: string | null;
  payment_method: string | null;
  payment_status: string | null;
  total_amount: number | null;
  created_at: string;
};

const getReadIds = (storageKey: string) => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

export function NotificationBell() {
  const { user, isAdmin } = useAuth();
  const { settings } = useAgendaBranding();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const hasLoadedRef = useRef(false);
  const previousUnreadRef = useRef(0);
  const readStorageKey = `happycash_agenda_read_notifs:${user?.id || 'anon'}:${isAdmin ? settings.storeAccountId || 'admin' : 'client'}`;

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    if (isAdmin && !settings.storeAccountId) return;

    const appointmentQuery = supabase
      .from('appointments')
      .select('id, client_name, appointment_date, appointment_time, status, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20);

    const { data: appointments } = isAdmin
      ? await appointmentQuery.eq('store_account_id', settings.storeAccountId)
      : await appointmentQuery.eq('client_id', user.id);

    const orderQuery = supabase
      .from('agenda_product_orders')
      .select('id, client_name, payment_method, payment_status, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: productOrders } = isAdmin
      ? await orderQuery.eq('store_account_id', settings.storeAccountId)
      : await orderQuery.eq('client_id', user.id);

    const notifs: Notification[] = [];

    if (appointments) {
      (appointments as AppointmentNotificationRow[]).forEach((apt) => {
        const time = apt.appointment_time?.slice(0, 5);
        const appointmentInfo = `${apt.appointment_date}${time ? ` às ${time}` : ''}`;
        const clientInfo = apt.client_name ? `${apt.client_name} - ${appointmentInfo}` : appointmentInfo;

        if (apt.status === 'scheduled') {
          notifs.push({
            id: `apt-${apt.id}`,
            type: 'appointment_scheduled',
            title: isAdmin ? '📅 Novo agendamento' : '📅 Agendamento confirmado',
            description: isAdmin ? clientInfo : appointmentInfo,
            created_at: apt.created_at,
            read: false,
          });
        } else if (apt.status === 'cancelled') {
          notifs.push({
            id: `cancel-${apt.id}`,
            type: 'appointment_cancelled',
            title: '❌ Agendamento cancelado',
            description: isAdmin ? clientInfo : appointmentInfo,
            created_at: apt.updated_at || apt.created_at,
            read: false,
          });
        }
      });
    }

    if (productOrders) {
      (productOrders as ProductOrderNotificationRow[]).forEach((order) => {
        const paymentInfo = order.payment_method === 'pix'
          ? order.payment_status === 'paid'
            ? 'Pix confirmado'
            : 'Pix aguardando confirmacao'
          : 'Pagar no local';
        const total = Number(order.total_amount || 0).toFixed(2);
        const date = new Date(order.created_at);
        const timeInfo = `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}`;

        notifs.push({
          id: `order-${order.id}`,
          type: 'purchase',
          title: isAdmin ? '🛍️ Novo pedido de produto' : '🛍️ Pedido registrado',
          description: isAdmin
            ? `${order.client_name || 'Cliente'} - R$ ${total} - ${paymentInfo}`
            : `${settings.displayName} - ${timeInfo} - ${paymentInfo}`,
          created_at: order.created_at,
          read: false,
        });
      });
    }

    // Sort by date
    notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const readIds = getReadIds(readStorageKey);
    notifs.forEach(n => {
      if (readIds.includes(n.id)) n.read = true;
    });

    const unreadCount = notifs.filter(n => !n.read).length;
    if (hasLoadedRef.current && unreadCount > previousUnreadRef.current) {
      playNotificationSound();
    }

    previousUnreadRef.current = unreadCount;
    hasLoadedRef.current = true;
    setNotifications(notifs);
  }, [isAdmin, readStorageKey, settings.displayName, settings.storeAccountId, user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for appointments and product orders
  useEffect(() => {
    if (!user) return;
    if (isAdmin && !settings.storeAccountId) return;

    const channel = supabase
      .channel(`agenda-notifications-${user.id}-${isAdmin ? settings.storeAccountId : 'client'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: isAdmin
            ? `store_account_id=eq.${settings.storeAccountId}`
            : `client_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agenda_product_orders',
          filter: isAdmin
            ? `store_account_id=eq.${settings.storeAccountId}`
            : `client_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, isAdmin, settings.storeAccountId, user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    localStorage.setItem(readStorageKey, JSON.stringify(ids));
    previousUnreadRef.current = 0;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Mark as read when opening
      setTimeout(markAllRead, 1500);
    }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Marcar como lidas
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 transition-colors ${
                    !notif.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.read ? 'font-semibold' : 'font-medium'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {notif.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
