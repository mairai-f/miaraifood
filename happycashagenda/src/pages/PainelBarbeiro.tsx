/**
 * ==============================================================
 * PÁGINA: BarberDashboard (Painel do Barbeiro)
 * ==============================================================
 *
 * PROPÓSITO:
 * Painel exclusivo para barbeiros visualizarem seus agendamentos,
 * comissões acumuladas e gerenciarem clientes.
 *
 * FUNCIONALIDADES:
 * - Dashboard com gráficos e estatísticas
 * - Lista de agendamentos (abertos, concluídos, cancelados)
 * - Adicionar novo agendamento para cliente
 * - Cancelar agendamentos
 * - Serviços mais realizados
 *
 * ==============================================================
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, TrendingUp, Loader2, DollarSign,
  CheckCircle, XCircle, AlertCircle, Scissors, Plus, UserPlus, Bell,
  Wifi, WifiOff, Info, Trophy
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoyaltyTab } from '@/components/admin/LoyaltyTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/useAuth';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';
import { playNotificationSound, shouldPlayAgendaSound } from '@/lib/notificationSound';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { useBusinessHours } from '@/hooks/useBusinessHours';

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  payment_method: string | null;
  payment_status: string | null;
  service: { id: string; name: string; price: number; duration_minutes: number };
}

interface BarberData {
  id: string;
  name: string;
  commission: number;
  photo_url: string | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

type AppointmentRealtimeRow = {
  id?: string;
  client_name?: string;
  appointment_date?: string;
  appointment_time?: string | null;
  status?: Appointment['status'];
  appointment_type?: 'appointment' | 'queue';
  payment_method?: string | null;
  payment_status?: string | null;
};

type BarberAppointmentRpcRow = {
  id: string;
  client_name: string;
  client_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  status: Appointment['status'];
  payment_method: string | null;
  payment_status: string | null;
  service_id: string;
  service_name: string;
  service_price: number | string | null;
  service_duration: number | string | null;
};

type BarberExtraServiceRpcRow = {
  appointment_id: string;
  service_id: string;
  service_name: string;
  service_price: number | string | null;
  service_duration?: number | string | null;
};

type BookedSlotRpcRow = {
  appointment_time: string | null;
  duration_minutes: number | string | null;
};

const CHART_COLORS = ['hsl(220, 60%, 35%)', 'hsl(38, 80%, 55%)', 'hsl(160, 60%, 45%)', 'hsl(280, 60%, 50%)', 'hsl(350, 60%, 50%)'];

const clearBarberSession = () => {
  sessionStorage.removeItem('barber_id');
  sessionStorage.removeItem('barber_name');
  sessionStorage.removeItem('barber_session_token');
  sessionStorage.removeItem('barber_business_slug');
};

const getBarberSessionToken = () => sessionStorage.getItem('barber_session_token') || '';

export default function BarberDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barberData, setBarberData] = useState<BarberData | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBarber, setIsBarber] = useState(false);
  const [barberIdFromSession, setBarberIdFromSession] = useState<string | null>(null);

  // New appointment dialog
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Add service to existing appointment dialog
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [additionalServiceId, setAdditionalServiceId] = useState('');
  const [extraServices, setExtraServices] = useState<{appointment_id: string; services: {id: string; name: string; price: number; duration_minutes?: number}[]}[]>([]);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsAppointment, setDetailsAppointment] = useState<Appointment | null>(null);
  const [appointmentPendingCancel, setAppointmentPendingCancel] = useState<Appointment | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { settings } = useAgendaBranding();
  const { toast } = useToast();
  const { requestPermission, sendNotification, permission } = usePushNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const { businessHours } = useBusinessHours(settings.storeAccountId);
  const previousAppointmentsRef = useRef<Appointment[]>([]);

  useEffect(() => {
    if (!settings.storeAccountId) return;

    // Check for barber session from login
    const sessionBarberId = sessionStorage.getItem('barber_id');
    const sessionBarberName = sessionStorage.getItem('barber_name');
    const sessionBarberToken = getBarberSessionToken();
    const sessionBusinessSlug = sessionStorage.getItem('barber_business_slug');

    if (
      !settings.storeAccountId &&
      sessionBarberId &&
      sessionBarberName &&
      sessionBarberToken &&
      sessionBusinessSlug &&
      !new URLSearchParams(location.search).has('empresa')
    ) {
      navigate(`/painel-profissional?empresa=${encodeURIComponent(sessionBusinessSlug)}`, { replace: true });
      return;
    }

    if (sessionBarberId && sessionBarberName && sessionBarberToken) {
      setBarberIdFromSession(sessionBarberId);
      loadBarberBySession(sessionBarberId);
    } else if (sessionBarberId || sessionBarberName || sessionBarberToken) {
      clearBarberSession();
      navigate('/login');
    } else if (!authLoading && !user) {
      navigate('/login');
    } else if (user) {
      checkBarberAccess();
    }
  }, [settings.storeAccountId, user, authLoading, navigate, location.search]);

  // Request notification permission on mount
  useEffect(() => {
    if ((barberIdFromSession || isBarber) && permission !== 'granted') {
      requestPermission();
    }
  }, [barberIdFromSession, isBarber, permission, requestPermission]);

  // Realtime: atualiza imediatamente quando um cliente agenda/edita/cancela
  useEffect(() => {
    if (!barberData?.id) return;

    const appointmentsChannel = supabase
      .channel(`barber-appointments-${barberData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `barber_id=eq.${barberData.id}`,
        },
        (payload) => {
          setRealtimeActive(true);
          const newApt = payload.new as AppointmentRealtimeRow;
          if (shouldPlayAgendaSound(settings, 'new_appointment')) {
            playNotificationSound();
          }
          toast({
            title: '📅 Novo Agendamento!',
            description: `${newApt.client_name} agendou para ${format(parseLocalDate(newApt.appointment_date), "dd/MM")} às ${newApt.appointment_time?.slice(0, 5)}`,
          });
          sendNotification('📅 Novo Agendamento!', {
            body: `${newApt.client_name} agendou para ${format(parseLocalDate(newApt.appointment_date), "dd/MM")} às ${newApt.appointment_time?.slice(0, 5)}`,
            tag: `new-${newApt.id}`,
          });
          fetchAppointments(barberData.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `barber_id=eq.${barberData.id}`,
        },
        (payload) => {
          setRealtimeActive(true);
          const updatedApt = payload.new as AppointmentRealtimeRow;
          const oldApt = payload.old as AppointmentRealtimeRow;

          // Atualização otimista (evita “pendente” ficar visível até o refetch)
          if (updatedApt?.id) {
            setAppointments((prev) =>
              prev.map((a) =>
                a.id === updatedApt.id
                  ? {
                      ...a,
                      status: updatedApt.status ?? a.status,
                      appointment_date: updatedApt.appointment_date ?? a.appointment_date,
                      appointment_time: updatedApt.appointment_time ?? a.appointment_time,
                      payment_method: updatedApt.payment_method ?? a.payment_method,
                      payment_status: updatedApt.payment_status ?? a.payment_status,
                    }
                  : a
              )
            );
          }

          // Notifica cancelamentos
          if (oldApt.status !== 'cancelled' && updatedApt.status === 'cancelled') {
            if (shouldPlayAgendaSound(settings, 'cancellation')) {
              playNotificationSound('alert');
            }
            toast({
              title: '❌ Agendamento Cancelado',
              description: `${updatedApt.client_name} - agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)} foi cancelado`,
              variant: 'destructive',
            });
            sendNotification('❌ Agendamento Cancelado', {
              body: `${updatedApt.client_name} cancelou o agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)}`,
              tag: `cancelled-${updatedApt.id}`,
            });
          }

          // Notifica quando admin marca como concluído
          if (oldApt.status !== 'completed' && updatedApt.status === 'completed') {
            if (shouldPlayAgendaSound(settings, 'completion')) {
              playNotificationSound('success');
            }
            toast({
              title: '✅ Serviço Concluído',
              description: `Admin confirmou: ${updatedApt.client_name} - ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)}`,
            });
            sendNotification('✅ Serviço Concluído pelo Admin', {
              body: `${updatedApt.client_name} - agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)} foi concluído`,
              tag: `completed-${updatedApt.id}`,
            });
          } else if (
            updatedApt.status === 'scheduled' &&
            oldApt.status === 'scheduled' &&
            (
              oldApt.appointment_date !== updatedApt.appointment_date ||
              oldApt.appointment_time !== updatedApt.appointment_time
            )
          ) {
            if (shouldPlayAgendaSound(settings, 'reschedule')) {
              playNotificationSound();
            }
            toast({
              title: '🔄 Agendamento Remarcado',
              description: `${updatedApt.client_name} mudou para ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)}.`,
            });
            sendNotification('🔄 Agendamento Remarcado', {
              body: `${updatedApt.client_name} reagendou para ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)}`,
              tag: `rescheduled-${updatedApt.id}-${updatedApt.appointment_date}-${updatedApt.appointment_time}`,
            });
          }

          fetchAppointments(barberData.id);
        }
      )
      .subscribe((status) => {
        setRealtimeActive(status === 'SUBSCRIBED');
      });
    const servicesChannel = supabase
      .channel(`barber-appointment-services-${barberData.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_services',
        },
        () => {
          fetchAppointments(barberData.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(servicesChannel);
    };
  }, [barberData?.id, sendNotification, settings, toast]);

  // Fallback de sincronização: quando o barbeiro está logado via sessão (sem auth),
  // o realtime pode não entregar eventos por causa de RLS. Fazemos polling curto
  // para garantir remoção instantânea de "pendentes" após cancelamentos.
  useEffect(() => {
    if (!barberData?.id) return;
    if (!barberIdFromSession) return;

    const refresh = () => fetchAppointments(barberData.id);

    // Atualiza ao voltar para a aba
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    // Polling rápido
    const intervalId = window.setInterval(refresh, 2000);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [barberData?.id, barberIdFromSession]);

  const loadBarberBySession = async (barberId: string) => {
    const sessionToken = getBarberSessionToken();
    const { data: validSession, error: sessionError } = await supabase.rpc('verify_barber_session', {
      p_barber_id: barberId,
      p_session_token: sessionToken,
    });

    if (sessionError || !validSession) {
      clearBarberSession();
      navigate('/login');
      setLoading(false);
      return;
    }

    const { data: barber } = await supabase
      .from('barbers')
      .select('id, name, commission, photo_url')
      .eq('id', barberId)
      .eq('store_account_id', settings.storeAccountId || '')
      .maybeSingle();

    if (barber) {
      setBarberData(barber);
      setIsBarber(true);
      await Promise.all([fetchAppointments(barber.id), fetchServices()]);
    } else {
      clearBarberSession();
      navigate('/login');
    }
    setLoading(false);
  };

  const checkBarberAccess = async () => {
    // Verificar se o usuário tem role 'barber'
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id)
      .eq('role', 'barber')
      .maybeSingle();

    if (!roleData) {
      toast({ title: 'Acesso negado', description: 'Você não tem permissão para acessar esta página.', variant: 'destructive' });
      navigate('/');
      return;
    }

    setIsBarber(true);

    // Buscar dados do barbeiro vinculado
    const { data: barber } = await supabase
      .from('barbers')
      .select('id, name, commission, photo_url')
      .eq('user_id', user!.id)
      .eq('store_account_id', settings.storeAccountId || '')
      .maybeSingle();

    if (barber) {
      setBarberData(barber);
      await Promise.all([fetchAppointments(barber.id), fetchServices()]);
    } else {
      toast({ title: 'Erro', description: 'Barbeiro não encontrado. Contate o administrador.', variant: 'destructive' });
    }

    setLoading(false);
  };

  const fetchAppointments = async (barberId: string) => {
    // Usar RPC para buscar agendamentos (bypassa RLS para barbeiros logados via sessão)
    const { data, error } = await supabase
      .rpc('get_barber_appointments', {
        p_barber_id: barberId,
        p_session_token: getBarberSessionToken(),
      });

    if (error) {
      console.error('Erro ao buscar agendamentos:', error);
      return;
    }

    if (data) {
      const formatted: Appointment[] = (data as BarberAppointmentRpcRow[]).map((apt) => ({
        id: apt.id,
        client_name: apt.client_name,
        client_phone: apt.client_phone,
        appointment_date: apt.appointment_date,
        appointment_time: apt.appointment_time,
        status: apt.status,
        payment_method: apt.payment_method,
        payment_status: apt.payment_status,
        service: {
          id: apt.service_id,
          name: apt.service_name,
          price: Number(apt.service_price) || 0,
          duration_minutes: Number(apt.service_duration) || 0
        }
      }));
      setAppointments(formatted);

      // Fetch extra services for each appointment using RPC
      const appointmentIds = formatted.map((a) => a.id);
      if (appointmentIds.length > 0) {
        // IMPORTANTE: barbeiro pode estar logado via sessão (sem auth.uid()).
        // Esta RPC é SECURITY DEFINER e valida por barber_id, garantindo acesso apenas aos próprios agendamentos.
        const { data: extraData } = await supabase.rpc('get_barber_appointment_extra_services', {
          p_barber_id: barberId,
          p_appointment_ids: appointmentIds,
          p_session_token: getBarberSessionToken(),
        });

        if (extraData) {
          const extraRows = extraData as BarberExtraServiceRpcRow[];
          const groupedExtras = appointmentIds.map((aptId: string) => ({
            appointment_id: aptId,
            services: extraRows
              .filter((e) => e.appointment_id === aptId)
              .map((e) => ({
                id: e.service_id,
                name: e.service_name,
                price: Number(e.service_price) || 0,
                duration_minutes: Number(e.service_duration) || 0
              }))
          }));
          setExtraServices(groupedExtras);
        }
      }
    }
  };

  const fetchServices = async () => {
    if (!settings.storeAccountId) return;
    const { data } = await supabase
      .from('services')
      .select('id, name, price, duration_minutes')
      .eq('store_account_id', settings.storeAccountId)
      .eq('is_active', true)
      .order('name');
    if (data) setServices(data);
  };

  // Helpers: extras + totais (precisa vir ANTES de ser usado nos cálculos abaixo)
  const getExtraServicesForAppointment = (aptId: string) => {
    return extraServices.find((e) => e.appointment_id === aptId)?.services || [];
  };

  const getTotalPrice = (apt: Appointment) => {
    const extras = getExtraServicesForAppointment(apt.id);
    const extrasTotal = extras.reduce((sum, s) => sum + (s.price || 0), 0);
    return (apt.service?.price || 0) + extrasTotal;
  };

  const getTotalDuration = (apt: Appointment) => {
    const extras = getExtraServicesForAppointment(apt.id);
    const extrasDuration = extras.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    return (apt.service?.duration_minutes || 0) + extrasDuration;
  };

  // Stats
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const monthlyAppointments = appointments.filter(a => {
    const date = parseLocalDate(a.appointment_date);
    return isWithinInterval(date, { start: monthStart, end: monthEnd });
  });

  const completedAppointments = monthlyAppointments.filter(a => a.status === 'completed');
  const scheduledAppointments = appointments.filter(a => a.status === 'scheduled');
  const cancelledAppointments = monthlyAppointments.filter(a => a.status === 'cancelled');

  // Total revenue: soma do serviço principal + adicionais (apenas concluídos)
  const getCompletedAppointmentTotal = (apt: Appointment) => getTotalPrice(apt);

  const totalRevenue = completedAppointments.reduce((sum, a) => sum + getCompletedAppointmentTotal(a), 0);
  // Commission based on percentage of total revenue (comissão é um valor fixo por serviço completo)
  // Agora: comissão é calculada por serviço (valor fixo), então soma (1 + extras) * comissão
  const totalServicesCompleted = completedAppointments.reduce((count, apt) => {
    const extras = getExtraServicesForAppointment(apt.id);
    return count + 1 + extras.length; // 1 for main service + extras
  }, 0);
  const totalCommission = totalServicesCompleted * (barberData?.commission || 0);

  // Chart data - últimos 7 dias
  const getLast7DaysData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayAppointments = appointments.filter(
        a => a.appointment_date === dateStr && a.status === 'completed'
      );
      data.push({
        name: format(date, 'EEE', { locale: ptBR }),
        servicos: dayAppointments.length,
      });
    }
    return data;
  };

  // Serviços mais realizados
  const getServiceDistribution = () => {
    const distribution: Record<string, number> = {};
    completedAppointments.forEach(a => {
      const serviceName = a.service?.name || 'Outro';
      distribution[serviceName] = (distribution[serviceName] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  // Generate available times for date
  const generateAvailableTimes = async (date: string) => {
    if (!date || !barberData || !selectedService) return;

    const dayOfWeek = new Date(date).getDay();
    const hours = businessHours.find(h => h.day_of_week === dayOfWeek);

    if (!hours || !hours.is_open) {
      setAvailableTimes([]);
      return;
    }

    const service = services.find(s => s.id === selectedService);
    const duration = service?.duration_minutes || 30;

    // Get existing scheduled appointments for that day (apenas 'scheduled' bloqueia)
    const { data: existingApts } = await supabase
      .rpc('get_barber_booked_slots', {
        p_barber_id: barberData.id,
        p_appointment_date: date
      });

    const bookedTimesWithDuration: { time: string; duration: number }[] = [];
    if (existingApts) {
      for (const row of existingApts as BookedSlotRpcRow[]) {
        const timeStr = String(row.appointment_time).slice(0, 5);
        const duration = Number(row.duration_minutes) || 0;
        if (timeStr && duration > 0) {
          bookedTimesWithDuration.push({ time: timeStr, duration });
        }
      }
    }

    const times: string[] = [];
    const [openHour, openMin] = hours.open_time.split(':').map(Number);
    const [closeHour, closeMin] = hours.close_time.split(':').map(Number);

    let current = openHour * 60 + openMin;
    const end = closeHour * 60 + closeMin;

    while (current + duration <= end) {
      const hour = Math.floor(current / 60);
      const min = current % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const slotStart = current;
      const slotEnd = current + duration;

      // Verificar conflito com agendamentos existentes
      let hasConflict = false;
      for (const booked of bookedTimesWithDuration) {
        const [bookedHour, bookedMin] = booked.time.split(':').map(Number);
        const bookedStart = bookedHour * 60 + bookedMin;
        const bookedEnd = bookedStart + booked.duration;

        // Sobreposição de intervalos
        if (slotStart < bookedEnd && slotEnd > bookedStart) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        // Check if it's not a past time for today
        if (date === format(today, 'yyyy-MM-dd')) {
          const now = today.getHours() * 60 + today.getMinutes();
          if (current > now) {
            times.push(timeStr);
          }
        } else {
          times.push(timeStr);
        }
      }
      current += 30; // 30 min intervals
    }

    setAvailableTimes(times);
  };

  useEffect(() => {
    if (selectedDate && selectedService) {
      generateAvailableTimes(selectedDate);
    }
  }, [selectedDate, selectedService]);

  // Cancel appointment - usando RPC para bypassar RLS (barbeiros logados via sessão)
  const cancelAppointment = async (appointment: Appointment) => {
    setAppointmentPendingCancel(appointment);
  };

  const confirmCancelAppointment = async () => {
    if (!appointmentPendingCancel || !barberData) return;

    setCancelLoading(true);
    if (!barberData) return;

    // Otimista: some imediatamente da lista de pendentes
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentPendingCancel.id ? { ...a, status: 'cancelled' } : a))
    );

    // Usar RPC para garantir que funciona mesmo com barbeiro logado via sessão
    const { error } = await supabase.rpc('barber_cancel_appointment', {
      p_barber_id: barberData.id,
      p_appointment_id: appointmentPendingCancel.id,
      p_session_token: getBarberSessionToken(),
    });

    if (error) {
      console.error('Erro ao cancelar:', error);
      toast({ title: 'Erro', description: error.message || 'Não foi possível cancelar.', variant: 'destructive' });
      // Reverte/garante sincronização
      fetchAppointments(barberData.id);
    } else {
      toast({ title: 'Cancelado', description: 'Agendamento cancelado com sucesso.' });
      fetchAppointments(barberData.id);
    }

    setAppointmentPendingCancel(null);
    setCancelLoading(false);
  };

  // Mark as completed - REMOVED: Barbeiros não podem marcar como concluído (apenas admin)
  // A conclusão será notificada via realtime quando o admin alterar o status

  // Create new appointment
  const createAppointment = async () => {
    if (!newClientName.trim() || !selectedService || !selectedDate || !selectedTime) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.rpc('create_barber_appointment', {
      p_barber_id: barberData!.id,
      p_session_token: getBarberSessionToken(),
      p_service_id: selectedService,
      p_client_name: newClientName,
      p_client_phone: newClientPhone || '',
      p_appointment_date: selectedDate,
      p_appointment_time: selectedTime,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível criar agendamento.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Agendamento criado com sucesso!' });
      setShowNewAppointmentDialog(false);
      resetNewAppointmentForm();
      if (barberData) fetchAppointments(barberData.id);
    }

    setSubmitting(false);
  };

  const resetNewAppointmentForm = () => {
    setNewClientName('');
    setNewClientPhone('');
    setSelectedService('');
    setSelectedDate('');
    setSelectedTime('');
    setAvailableTimes([]);
  };

  // Add extra service to existing appointment
  const openAddServiceDialog = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setAdditionalServiceId('');
    setShowAddServiceDialog(true);
  };

  const addServiceToAppointment = async () => {
    if (!selectedAppointment || !additionalServiceId || !barberData) {
      toast({ title: 'Erro', description: 'Selecione um serviço.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    // Usar RPC para bypassar RLS (barbeiros logados via sessão)
    const { error } = await supabase.rpc('add_service_to_appointment', {
      p_barber_id: barberData.id,
      p_appointment_id: selectedAppointment.id,
      p_service_id: additionalServiceId,
      p_session_token: getBarberSessionToken(),
    });

    if (error) {
      console.error('Erro ao adicionar serviço:', error);
      toast({ title: 'Erro', description: error.message || 'Não foi possível adicionar o serviço.', variant: 'destructive' });
    } else {
      const service = services.find(s => s.id === additionalServiceId);
      toast({ title: 'Serviço adicionado!', description: `${service?.name} foi adicionado ao agendamento.` });
      setShowAddServiceDialog(false);
      setSelectedAppointment(null);
      setAdditionalServiceId('');
      fetchAppointments(barberData.id);
    }

    setSubmitting(false);
  };

  // Helpers movidos acima para evitar erro em tempo de execução (ordem de declaração)

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isBarber) return null;

  const chartConfig = {
    servicos: { label: 'Serviços', color: 'hsl(220, 60%, 35%)' },
  };

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {barberData?.photo_url ? (
                <img
                  src={barberData.photo_url}
                  alt={barberData.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Scissors className="w-8 h-8 text-primary" />
                </div>
              )}
              <div>
                <h1 className="font-serif text-2xl font-bold">Bem-vindo, {barberData?.name}!</h1>
                <div className="flex items-center gap-2 mt-1">
                  {realtimeActive ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Wifi className="w-3 h-3" /> Realtime ativo
                    </span>
                  ) : barberIdFromSession ? (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <WifiOff className="w-3 h-3" /> Polling ativo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wifi className="w-3 h-3" /> Conectando...
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowNewAppointmentDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Agendamento
              </Button>
            {barberIdFromSession && (
              <Button
                variant="outline"
                onClick={() => {
                  clearBarberSession();
                  navigate('/');
                }}
              >
                Sair
              </Button>
            )}
            </div>
          </div>

          {/* Stats Cards - Compactos */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/10 rounded-full shrink-0">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">Pendentes</p>
                    <p className="text-xl sm:text-2xl font-bold text-accent">{scheduledAppointments.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 rounded-full shrink-0">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">Concluídos</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-600">{completedAppointments.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-destructive/10 rounded-full shrink-0">
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">Cancelados</p>
                    <p className="text-xl sm:text-2xl font-bold text-destructive">{cancelledAppointments.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row - Compactos */}
          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4 mb-6">
            {/* Weekly performance chart */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                <CardTitle className="font-serif text-sm sm:text-base">Últimos 7 dias</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6 pb-3">
                <ChartContainer config={chartConfig} className="h-[120px] sm:h-[150px] w-full">
                  <BarChart data={getLast7DaysData()} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} tickMargin={3} />
                    <YAxis tickLine={false} axisLine={false} fontSize={10} width={20} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="servicos" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Service distribution */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                <CardTitle className="font-serif text-sm sm:text-base">Top Serviços</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3">
                {getServiceDistribution().length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">Nenhum serviço concluído.</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <ChartContainer config={chartConfig} className="h-[100px] w-[100px] shrink-0">
                      <PieChart>
                        <Pie
                          data={getServiceDistribution()}
                          cx="50%"
                          cy="50%"
                          innerRadius={20}
                          outerRadius={40}
                          dataKey="value"
                        >
                          {getServiceDistribution().map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                    <div className="flex-1 space-y-1 min-w-0">
                      {getServiceDistribution().slice(0, 4).map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className="text-xs truncate">{item.name}</span>
                          </div>
                          <span className="text-xs font-medium shrink-0">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Appointments Tabs */}
          <Tabs defaultValue="scheduled">
            <TabsList className="mb-4 w-full grid grid-cols-4 h-auto">
              <TabsTrigger value="scheduled" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden xs:inline">Abertos</span> ({scheduledAppointments.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden xs:inline">Concluídos</span> ({completedAppointments.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden xs:inline">Cancelados</span> ({cancelledAppointments.length})
              </TabsTrigger>
              <TabsTrigger value="loyalty" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden xs:inline">Metas</span>
              </TabsTrigger>
            </TabsList>



            <TabsContent value="scheduled">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">Agendamentos Pendentes</CardTitle>
                  <CardDescription>Serviços agendados para atendimento</CardDescription>
                </CardHeader>
                <CardContent>
                  {scheduledAppointments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum agendamento pendente.</p>
                  ) : (
                    <div className="space-y-2">
                      {scheduledAppointments.map((apt) => {
                        const extras = getExtraServicesForAppointment(apt.id);
                        const totalPrice = getTotalPrice(apt);
                        const totalDuration = getTotalDuration(apt);
                        return (
                          <div
                            key={apt.id}
                            className="p-3 rounded-lg bg-secondary/50 border border-border"
                          >
                            {/* Header compacto: Data/hora + Cliente + Valor */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="text-center shrink-0 bg-primary/10 rounded px-2 py-1">
                                  <p className="text-xs font-medium">{format(parseLocalDate(apt.appointment_date), "dd/MM")}</p>
                                  <p className="text-sm font-bold">{apt.appointment_time.slice(0, 5)}</p>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate">{apt.client_name}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-semibold text-sm">R$ {totalPrice.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                  <Clock className="w-3 h-3" /> {totalDuration}min
                                </p>
                              </div>
                            </div>

                            {/* Detalhamento dos serviços com duração e preço */}
                            <div className="space-y-0.5 mb-2 text-xs border-t border-border/50 pt-2">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <Scissors className="w-3 h-3 text-muted-foreground" />
                                  {apt.service?.name}
                                  <span className="text-muted-foreground">({apt.service?.duration_minutes}min)</span>
                                </span>
                                <span className="text-muted-foreground">R$ {apt.service?.price?.toFixed(2)}</span>
                              </div>
                              {extras.map((extra) => (
                                <div key={extra.id} className="flex items-center justify-between text-primary">
                                  <span className="flex items-center gap-1">
                                    <Plus className="w-3 h-3" />
                                    {extra.name}
                                    <span className="text-primary/70">({extra.duration_minutes}min)</span>
                                  </span>
                                  <span>R$ {extra.price?.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            {/* Botões compactos em grid - Barbeiro NÃO pode concluir (apenas admin) */}
                            <div className="grid grid-cols-3 gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary hover:bg-primary/10 text-xs h-8 px-2"
                                onClick={() => {
                                  setDetailsAppointment(apt);
                                  setShowDetailsDialog(true);
                                }}
                              >
                                <Info className="w-3 h-3 mr-1" />
                                <span className="hidden xs:inline">Detalhes</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary hover:bg-primary/10 text-xs h-8 px-2"
                                onClick={() => openAddServiceDialog(apt)}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                <span className="hidden xs:inline">Serviço</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10 text-xs h-8 px-2"
                                onClick={() => cancelAppointment(apt)}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                <span className="hidden xs:inline">Cancelar</span>
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground text-center mt-1 italic">
                              Apenas o admin pode marcar como concluído
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="completed">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">Serviços Concluídos</CardTitle>
                  <CardDescription>Agendamentos finalizados neste mês</CardDescription>
                </CardHeader>
                <CardContent>
                  {completedAppointments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum serviço concluído neste mês.</p>
                  ) : (
                    <div className="space-y-3">
                      {completedAppointments.map((apt) => {
                        const extras = getExtraServicesForAppointment(apt.id);
                        const totalPrice = getTotalPrice(apt);
                        const totalServices = 1 + extras.length;
                        const totalCommission = totalServices * (barberData?.commission || 0);
                        return (
                          <div
                            key={apt.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 gap-3"
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-center min-w-[60px]">
                                <p className="text-sm font-medium">{format(parseLocalDate(apt.appointment_date), "dd/MM")}</p>
                                <p className="text-lg font-bold">{apt.appointment_time.slice(0, 5)}</p>
                              </div>
                              <div>
                                <p className="font-medium">{apt.client_name}</p>
                                <div className="space-y-0.5">
                                  <p className="text-sm text-muted-foreground">
                                    {apt.service?.name} <span className="text-xs">({apt.service?.duration_minutes}min)</span> - <span className="text-foreground">R$ {apt.service?.price?.toFixed(2)}</span>
                                  </p>
                                  {extras.map((extra) => (
                                    <p key={extra.id} className="text-sm text-primary">
                                      + {extra.name} <span className="text-xs">({extra.duration_minutes}min)</span> - R$ {extra.price?.toFixed(2)}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">Total: R$ {totalPrice.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                <Clock className="w-3 h-3" /> {getTotalDuration(apt)} min
                              </p>
                              {extras.length > 0 && (
                                <p className="text-xs text-muted-foreground">{totalServices} serviços</p>
                              )}
                              <p className="text-xs text-emerald-600">+R$ {totalCommission.toFixed(2)} comissão</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cancelled">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">Agendamentos Cancelados</CardTitle>
                  <CardDescription>Cancelamentos neste mês</CardDescription>
                </CardHeader>
                <CardContent>
                  {cancelledAppointments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum cancelamento neste mês.</p>
                  ) : (
                    <div className="space-y-3">
                      {cancelledAppointments.map((apt) => {
                        const extras = getExtraServicesForAppointment(apt.id);
                        const totalPrice = getTotalPrice(apt);
                        return (
                          <div
                            key={apt.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20 opacity-60 gap-3"
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-center min-w-[60px]">
                                <p className="text-sm font-medium">{format(parseLocalDate(apt.appointment_date), "dd/MM")}</p>
                                <p className="text-lg font-bold">{apt.appointment_time.slice(0, 5)}</p>
                              </div>
                              <div>
                                <p className="font-medium">{apt.client_name}</p>
                                <div className="space-y-0.5">
                                  <p className="text-sm text-muted-foreground">
                                    {apt.service?.name} <span className="text-xs">({apt.service?.duration_minutes}min)</span> - R$ {apt.service?.price?.toFixed(2)}
                                  </p>
                                  {extras.map((extra) => (
                                    <p key={extra.id} className="text-sm text-destructive/70">
                                      + {extra.name} <span className="text-xs">({extra.duration_minutes}min)</span> - R$ {extra.price?.toFixed(2)}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-sm text-muted-foreground">R$ {totalPrice.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {getTotalDuration(apt)} min
                              </span>
                              <StatusBadge status={apt.status} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loyalty">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Metas de Fidelidade
                  </CardTitle>
                  <CardDescription>Acompanhe o progresso dos clientes (somente leitura)</CardDescription>
                </CardHeader>
                <CardContent>
                  <LoyaltyTab isAdmin={false} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* New Appointment Dialog */}
        <Dialog open={showNewAppointmentDialog} onOpenChange={setShowNewAppointmentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Agendamento</DialogTitle>
              <DialogDescription>Adicione um cliente para um horário disponível</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nome do Cliente *</Label>
                <Input
                  id="clientName"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Telefone</Label>
                <Input
                  id="clientPhone"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>Serviço *</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - R$ {service.price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={format(today, 'yyyy-MM-dd')}
                />
              </div>
              {selectedDate && selectedService && (
                <div className="space-y-2">
                  <Label>Horário *</Label>
                  {availableTimes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum horário disponível para esta data.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {availableTimes.map((time) => (
                        <Button
                          key={time}
                          type="button"
                          variant={selectedTime === time ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTime(time)}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowNewAppointmentDialog(false); resetNewAppointmentForm(); }}>
                Cancelar
              </Button>
              <Button onClick={createAppointment} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Agendar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Service Dialog */}
        <Dialog open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Serviço</DialogTitle>
              <DialogDescription>
                Adicionar serviço extra para {selectedAppointment?.client_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Lista completa de serviços já agendados */}
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Serviços agendados:</p>
                <p className="text-sm">
                  {selectedAppointment?.service?.name} - <span className="font-medium">R$ {selectedAppointment?.service?.price?.toFixed(2)}</span>
                </p>
                {selectedAppointment && getExtraServicesForAppointment(selectedAppointment.id).map((extra) => (
                  <p key={extra.id} className="text-sm text-primary">
                    + {extra.name} - R$ {extra.price?.toFixed(2)}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground pt-1 border-t mt-2">
                  Total atual: <span className="font-semibold">R$ {selectedAppointment ? getTotalPrice(selectedAppointment).toFixed(2) : '0.00'}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Adicionar Serviço</Label>
                <Select value={additionalServiceId} onValueChange={setAdditionalServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services
                      .filter(s => {
                        // Filtrar serviços que já foram adicionados
                        const extrasIds = selectedAppointment
                          ? getExtraServicesForAppointment(selectedAppointment.id).map(e => e.id)
                          : [];
                        return s.id !== selectedAppointment?.service?.id && !extrasIds.includes(s.id);
                      })
                      .map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - R$ {service.price.toFixed(2)} ({service.duration_minutes}min)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {additionalServiceId && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium">Novo total:</p>
                  <p className="text-lg font-bold text-primary">
                    R$ {(
                      (selectedAppointment ? getTotalPrice(selectedAppointment) : 0) +
                      (services.find(s => s.id === additionalServiceId)?.price || 0)
                    ).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddServiceDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={addServiceToAppointment} disabled={submitting || !additionalServiceId}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Appointment Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Detalhes do Agendamento</DialogTitle>
              <DialogDescription>
                Informações completas do atendimento
              </DialogDescription>
            </DialogHeader>
            {detailsAppointment && (() => {
              const extras = getExtraServicesForAppointment(detailsAppointment.id);
              const totalPrice = getTotalPrice(detailsAppointment);
              const totalDuration = getTotalDuration(detailsAppointment);
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cliente</span>
                    <span className="font-medium">{detailsAppointment.client_name}</span>
                  </div>
                  {detailsAppointment.client_phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Telefone</span>
                      <span className="font-medium">{detailsAppointment.client_phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Data</span>
                    <span className="font-medium">{format(parseLocalDate(detailsAppointment.appointment_date), "dd/MM/yyyy")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Horário</span>
                    <span className="font-medium">{detailsAppointment.appointment_time.slice(0, 5)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status={detailsAppointment.status} />
                  </div>

                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-sm font-medium">Serviços</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Scissors className="w-3 h-3 text-muted-foreground" />
                          {detailsAppointment.service?.name}
                          <span className="text-xs text-muted-foreground">({detailsAppointment.service?.duration_minutes}min)</span>
                        </span>
                        <span>R$ {detailsAppointment.service?.price?.toFixed(2)}</span>
                      </div>
                      {extras.map((extra) => (
                        <div key={extra.id} className="flex items-center justify-between text-sm text-primary">
                          <span className="flex items-center gap-1">
                            <Plus className="w-3 h-3" />
                            {extra.name}
                            <span className="text-xs text-primary/70">({extra.duration_minutes}min)</span>
                          </span>
                          <span>R$ {extra.price?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Duração Total</span>
                      <span className="font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {totalDuration} min
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Valor Total</span>
                      <span className="font-bold text-lg text-primary">R$ {totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={!!appointmentPendingCancel}
          onOpenChange={(open) => {
            if (!open && !cancelLoading) {
              setAppointmentPendingCancel(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
              <AlertDialogDescription>
                {appointmentPendingCancel
                  ? `O atendimento de ${appointmentPendingCancel.client_name} será cancelado e removido da agenda do profissional.`
                  : 'Confirme o cancelamento do agendamento.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelLoading}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => void confirmCancelAppointment()} disabled={cancelLoading}>
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelamento'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
