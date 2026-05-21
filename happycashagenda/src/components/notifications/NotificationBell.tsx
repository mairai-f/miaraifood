import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'purchase' | 'appointment_scheduled' | 'appointment_cancelled';
  title: string;
  description: string;
  created_at: string;
  read: boolean;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    // Fetch recent appointments for user
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, client_name, appointment_date, appointment_time, status, created_at, updated_at')
      .eq('client_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    const notifs: Notification[] = [];

    if (appointments) {
      appointments.forEach((apt) => {
        if (apt.status === 'scheduled') {
          notifs.push({
            id: `apt-${apt.id}`,
            type: 'appointment_scheduled',
            title: '📅 Agendamento confirmado',
            description: `${apt.appointment_date} às ${apt.appointment_time}`,
            created_at: apt.created_at,
            read: false,
          });
        } else if (apt.status === 'cancelled') {
          notifs.push({
            id: `cancel-${apt.id}`,
            type: 'appointment_cancelled',
            title: '❌ Agendamento cancelado',
            description: `${apt.appointment_date} às ${apt.appointment_time}`,
            created_at: apt.updated_at,
            read: false,
          });
        }
      });
    }

    // Sort by date
    notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Check read state from localStorage
    const readIds = JSON.parse(localStorage.getItem('barberpro_read_notifs') || '[]');
    notifs.forEach(n => {
      if (readIds.includes(n.id)) n.read = true;
    });

    setNotifications(notifs);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for appointments
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    localStorage.setItem('barberpro_read_notifs', JSON.stringify(ids));
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
