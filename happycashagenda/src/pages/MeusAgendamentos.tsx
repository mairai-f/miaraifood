import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Scissors, X, Loader2, Trophy, CalendarSync } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Layout } from '@/components/layout/Layout';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { supabase } from '@/integrations/supabase/client';
import { LoyaltyTab } from '@/components/admin/LoyaltyTab';
import { cn, parseLocalDate } from '@/lib/utils';
import { withAgendaPublicSearch } from '@/lib/agendaPublicLink';
import {
  buildAppointmentCancellationWhatsAppMessage,
  buildAppointmentRescheduleWhatsAppMessage,
  openAgendaWhatsAppTargets,
} from '@/lib/agendaWhatsApp';
import { playNotificationSound, shouldPlayAgendaSound } from '@/lib/notificationSound';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';

interface ExtraService {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Appointment {
  id: string;
  client_name: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type?: 'appointment' | 'queue';
  barber_id: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  barber: { name: string; phone?: string | null };
  service: { name: string; price: number; duration_minutes: number };
  extraServices: ExtraService[];
}

interface AppointmentRealtimeRow {
  id?: string;
  store_account_id?: string;
  status?: Appointment['status'];
  appointment_date?: string;
  appointment_time?: string;
  appointment_type?: Appointment['appointment_type'];
  client_name?: string;
}

interface AppointmentServiceRealtimeRow {
  appointment_id?: string;
}

interface AppointmentExtraServiceRow {
  appointment_id: string;
  service_id: string;
  service_name: string;
  service_price: number | string | null;
  service_duration?: number | string | null;
}

type BookedSlotRow = {
  appointment_time: string | null;
  duration_minutes: number | null;
};

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleAllSlots, setRescheduleAllSlots] = useState<string[]>([]);
  const [rescheduleBookedSlots, setRescheduleBookedSlots] = useState<string[]>([]);
  const [rescheduleExceededSlots, setRescheduleExceededSlots] = useState<string[]>([]);
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { requestPermission, sendNotification, permission } = usePushNotifications();
  const { settings } = useAgendaBranding();
  const { getAvailableTimeSlots, getAllBusinessSlots, getHoursForDay } = useBusinessHours(settings.storeAccountId);
  const navigate = useNavigate();
  const publicLoginPath = withAgendaPublicSearch('/login', settings);
  const publicBookingPath = withAgendaPublicSearch('/agendamento', settings);
  const rescheduleNoticeHours = Math.max(0, settings.rescheduleNoticeHours ?? 2);
  const cancellationNoticeHours = Math.max(0, settings.cancellationNoticeHours ?? 0);

  // Cache para saber quais agendamentos pertencem ao cliente (usado no realtime de serviços)
  const appointmentIdsRef = useRef<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    if (user && permission !== 'granted') {
      requestPermission();
    }
  }, [user, permission, requestPermission]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(publicLoginPath);
    }
  }, [user, authLoading, navigate, publicLoginPath]);

  useEffect(() => {
    if (user && settings.storeAccountId) {
      fetchAppointments();
      fetchProfileName();

      // Subscribe to realtime changes for this client's appointments
      const appointmentsChannel = supabase
        .channel('client-appointments-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'appointments',
            filter: `client_id=eq.${user.id}`
          },
          (payload) => {
            const updatedApt = payload.new as AppointmentRealtimeRow;
            const oldApt = payload.old as AppointmentRealtimeRow;
            if (
              updatedApt.store_account_id &&
              updatedApt.store_account_id !== settings.storeAccountId
            ) {
              return;
            }

            // Otimista: tira instantaneamente de "Próximos" ao cancelar/concluir
            if (updatedApt?.id) {
              setAppointments((prev) =>
                prev.map((a) =>
                  a.id === updatedApt.id
                    ? {
                        ...a,
                        status: updatedApt.status,
                        appointment_date: updatedApt.appointment_date ?? a.appointment_date,
                        appointment_time: updatedApt.appointment_time ?? a.appointment_time,
                      }
                    : a
                )
              );
            }

            fetchAppointments();

            // Notify client when their appointment status changes
            if (oldApt.status !== 'completed' && updatedApt.status === 'completed') {
              if (shouldPlayAgendaSound(settings, 'completion')) {
                playNotificationSound('success');
              }
              toast({
                title: '✅ Atendimento Concluído',
                description: `Seu agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} foi concluído!`,
              });
              sendNotification('✅ Atendimento Concluído', {
                body: `Seu agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)} foi concluído!`,
                tag: `completed-${updatedApt.id}`,
              });
            } else if (oldApt.status !== 'cancelled' && updatedApt.status === 'cancelled') {
              if (shouldPlayAgendaSound(settings, 'cancellation')) {
                playNotificationSound('alert');
              }
              toast({
                title: '❌ Agendamento Cancelado',
                description: `Seu agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} foi cancelado.`,
                variant: 'destructive',
              });
              sendNotification('❌ Agendamento Cancelado', {
                body: `Seu agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)} foi cancelado.`,
                tag: `cancelled-${updatedApt.id}`,
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
                title: '🔄 Horário Remarcado',
                description: `Seu novo horário ficou para ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)}.`,
              });
              sendNotification('🔄 Horário Remarcado', {
                body: `Novo horário: ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)}.`,
                tag: `rescheduled-${updatedApt.id}-${updatedApt.appointment_date}-${updatedApt.appointment_time}`,
              });
            }
          }
        )
        .subscribe();

      // Realtime para serviços extras adicionados/removidos (atualiza total e lista imediatamente)
      const servicesChannel = supabase
        .channel('client-appointment-services-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointment_services',
          },
          (payload) => {
            const newRow = payload.new as AppointmentServiceRealtimeRow;
            const oldRow = payload.old as AppointmentServiceRealtimeRow;
            const aptId = newRow?.appointment_id ?? oldRow?.appointment_id;
            if (aptId && appointmentIdsRef.current.has(aptId)) {
              fetchAppointments();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(appointmentsChannel);
        supabase.removeChannel(servicesChannel);
      };
    } else if (user && !settings.storeAccountId) {
      setAppointments([]);
      setLoading(false);
    }
  }, [settings, settings.storeAccountId, user]);

  const fetchAppointments = async () => {
    if (!user || !settings.storeAccountId) return;

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        appointment_date,
        appointment_time,
        appointment_type,
        barber_id,
        status,
        barber:barbers(name, phone),
        service:services(name, price, duration_minutes)
      `)
      .eq('client_id', user.id)
      .eq('store_account_id', settings.storeAccountId)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (!error && data) {
      const appointmentIds = data.map((a) => a.id);
      appointmentIdsRef.current = new Set(appointmentIds);

      // Buscar serviços extras via RPC (evita dependência de FK e garante dados completos)
      const extraServicesMap: Record<string, ExtraService[]> = {};

      if (appointmentIds.length > 0) {
        const { data: extraData, error: extraError } = await supabase
          .rpc('get_appointment_extra_services', { p_appointment_ids: appointmentIds });

        if (!extraError && extraData) {
          (extraData as AppointmentExtraServiceRow[]).forEach((e) => {
            if (!extraServicesMap[e.appointment_id]) extraServicesMap[e.appointment_id] = [];
            extraServicesMap[e.appointment_id].push({
              id: e.service_id,
              name: e.service_name,
              price: Number(e.service_price) || 0,
              duration_minutes: Number(e.service_duration) || 0,
            });
          });
        }
      }

      const formatted = data.map((apt) => ({
        ...apt,
        barber: apt.barber as unknown as { name: string; phone?: string | null },
        service: apt.service as unknown as { name: string; price: number; duration_minutes: number },
        extraServices: extraServicesMap[apt.id] || [],
      }));
      setAppointments(formatted);
    }
    setLoading(false);
  };

  const fetchProfileName = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setProfileName(data.full_name || data.username || '');
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;

    setCancellingId(selectedAppointment.id);
    const { error } = await supabase.rpc('cancel_client_appointment', {
      p_appointment_id: selectedAppointment.id,
    });

    setCancellingId(null);
    setShowCancelDialog(false);

    if (error) {
      toast({
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar o agendamento.',
        variant: 'destructive',
      });
      fetchAppointments();
    } else {
      const serviceNames = [
        selectedAppointment.service?.name,
        ...selectedAppointment.extraServices.map((service) => service.name),
      ].filter((serviceName): serviceName is string => Boolean(serviceName));
      const cancellationMessage = buildAppointmentCancellationWhatsAppMessage({
        businessName: settings.displayName,
        clientName: selectedAppointment.client_name,
        professionalName: selectedAppointment.barber?.name || settings.professionalLabel,
        serviceNames,
        appointmentDate: selectedAppointment.appointment_date,
        appointmentTime: selectedAppointment.appointment_time,
        totalAmount: getTotalPrice(selectedAppointment),
      });

      openAgendaWhatsAppTargets({
        professionalPhone: selectedAppointment.barber?.phone,
        adminPhone: settings.adminWhatsapp || settings.whatsapp,
        clientMessage: cancellationMessage,
        adminMessage: cancellationMessage,
      });

      toast({
        title: 'Agendamento cancelado',
        description: 'Seu agendamento foi cancelado e o WhatsApp foi aberto para avisar a empresa.',
      });
      fetchAppointments();
    }
  };

  const openCancelDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancelDialog(true);
  };

  const getAppointmentStart = (appointment: Appointment) =>
    new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);

  const canRescheduleAppointment = (appointment: Appointment) => {
    if (appointment.status !== 'scheduled' || appointment.appointment_type === 'queue') {
      return false;
    }

    return getAppointmentStart(appointment).getTime() - Date.now() > rescheduleNoticeHours * 60 * 60 * 1000;
  };

  const canCancelAppointment = (appointment: Appointment) => {
    if (appointment.status !== 'scheduled') {
      return false;
    }

    return getAppointmentStart(appointment).getTime() - Date.now() > cancellationNoticeHours * 60 * 60 * 1000;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;

    const dayHours = getHoursForDay(date.getDay());
    return !dayHours?.is_open;
  };

  // Ordenar: Agendados primeiro, depois concluídos, depois cancelados
  const sortByStatus = (a: Appointment, b: Appointment) => {
    const statusOrder = { scheduled: 0, completed: 1, cancelled: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    // Dentro do mesmo status, ordenar por data (mais recente primeiro para histórico)
    return new Date(`${b.appointment_date}T${b.appointment_time}`).getTime() -
           new Date(`${a.appointment_date}T${a.appointment_time}`).getTime();
  };

  const upcomingAppointments = appointments
    .filter(apt => apt.status === 'scheduled' && new Date(`${apt.appointment_date}T${apt.appointment_time}`) >= new Date())
    .sort((a, b) => new Date(`${a.appointment_date}T${a.appointment_time}`).getTime() -
                    new Date(`${b.appointment_date}T${b.appointment_time}`).getTime());

  const pastAppointments = appointments
    .filter(apt => apt.status !== 'scheduled' || new Date(`${apt.appointment_date}T${apt.appointment_time}`) < new Date())
    .sort(sortByStatus);

  // Calcula preço total incluindo serviços extras
  const getTotalPrice = (apt: Appointment) => {
    const extrasTotal = apt.extraServices.reduce((sum, s) => sum + (s.price || 0), 0);
    return (apt.service?.price || 0) + extrasTotal;
  };

  // Calcula duração total incluindo serviços extras
  const getTotalDuration = (apt: Appointment) => {
    const extrasDuration = apt.extraServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    return (apt.service?.duration_minutes || 0) + extrasDuration;
  };

  const fetchRescheduleSlots = async (appointment: Appointment, date: Date) => {
    setRescheduleLoadingSlots(true);

    const dateString = format(date, 'yyyy-MM-dd');
    const totalDuration = getTotalDuration(appointment);
    const validSlots = getAvailableTimeSlots(date, totalDuration);
    const allBusinessSlots = getAllBusinessSlots(date);

    const { data: booked, error: bookedError } = await supabase.rpc('get_barber_booked_slots', {
      p_barber_id: appointment.barber_id,
      p_appointment_date: dateString,
    });

    const appointmentsWithDuration: { time: string; duration: number }[] = [];
    if (!bookedError && booked) {
      for (const row of booked as BookedSlotRow[]) {
        const timeStr = String(row.appointment_time).slice(0, 5);
        const duration = Number(row.duration_minutes) || 0;
        if (timeStr && duration > 0) {
          appointmentsWithDuration.push({ time: timeStr, duration });
        }
      }
    }

    const now = new Date();
    const todayString = format(now, 'yyyy-MM-dd');
    const isToday = dateString === todayString;
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const originalTime = appointment.appointment_time.slice(0, 5);
    const sameDayAsOriginal = dateString === appointment.appointment_date;

    const filterPast = (slot: string) => {
      if (!isToday) return true;
      const [h, m] = slot.split(':').map(Number);
      return h * 60 + m > currentTotalMinutes;
    };

    const filteredValidSlots = validSlots.filter(filterPast);
    const filteredAllSlots = allBusinessSlots.filter(filterPast);
    const exceededSet = new Set(filteredAllSlots.filter((slot) => !filteredValidSlots.includes(slot)));

    const occupiedSlots: string[] = [];
    const freeSlots: string[] = [];

    filteredValidSlots.forEach((slot) => {
      const isCurrentSlot = sameDayAsOriginal && slot === originalTime;
      if (isCurrentSlot) {
        freeSlots.push(slot);
        return;
      }

      const [slotHour, slotMin] = slot.split(':').map(Number);
      const slotStartMinutes = slotHour * 60 + slotMin;
      const slotEndMinutes = slotStartMinutes + totalDuration;

      let hasConflict = false;
      for (const bookedSlot of appointmentsWithDuration) {
        const [bookedHour, bookedMin] = bookedSlot.time.split(':').map(Number);
        const bookedStartMinutes = bookedHour * 60 + bookedMin;
        const bookedEndMinutes = bookedStartMinutes + bookedSlot.duration;
        if (slotStartMinutes < bookedEndMinutes && slotEndMinutes > bookedStartMinutes) {
          hasConflict = true;
          break;
        }
      }

      if (hasConflict) {
        occupiedSlots.push(slot);
      } else {
        freeSlots.push(slot);
      }
    });

    setRescheduleAllSlots([...filteredValidSlots, ...Array.from(exceededSet)].sort());
    setRescheduleBookedSlots(occupiedSlots);
    setRescheduleExceededSlots(Array.from(exceededSet));
    if (!freeSlots.includes(rescheduleTime)) {
      setRescheduleTime((current) =>
        current && freeSlots.includes(current) ? current : sameDayAsOriginal ? originalTime : '',
      );
    }
    setRescheduleLoadingSlots(false);
  };

  useEffect(() => {
    if (!showRescheduleDialog || !rescheduleAppointment || !rescheduleDate) {
      return;
    }

    void fetchRescheduleSlots(rescheduleAppointment, rescheduleDate);
  }, [showRescheduleDialog, rescheduleAppointment, rescheduleDate]);

  const openRescheduleDialog = (appointment: Appointment) => {
    setRescheduleAppointment(appointment);
    setRescheduleDate(parseLocalDate(appointment.appointment_date));
    setRescheduleTime(appointment.appointment_time.slice(0, 5));
    setRescheduleAllSlots([]);
    setRescheduleBookedSlots([]);
    setRescheduleExceededSlots([]);
    setShowRescheduleDialog(true);
  };

  const closeRescheduleDialog = () => {
    setShowRescheduleDialog(false);
    setRescheduleAppointment(null);
    setRescheduleDate(undefined);
    setRescheduleTime('');
    setRescheduleAllSlots([]);
    setRescheduleBookedSlots([]);
    setRescheduleExceededSlots([]);
    setRescheduleLoadingSlots(false);
  };

  const handleRescheduleAppointment = async () => {
    if (!rescheduleAppointment || !rescheduleDate || !rescheduleTime) {
      toast({
        title: 'Selecione o novo horário',
        description: 'Escolha uma data e um horário disponíveis para continuar.',
        variant: 'destructive',
      });
      return;
    }

    const nextDate = format(rescheduleDate, 'yyyy-MM-dd');
    const nextTime = `${rescheduleTime}:00`;
    if (
      nextDate === rescheduleAppointment.appointment_date &&
      nextTime === rescheduleAppointment.appointment_time
    ) {
      toast({
        title: 'Nenhuma alteração detectada',
        description: 'Escolha um novo horário para concluir a remarcação.',
        variant: 'destructive',
      });
      return;
    }

    setReschedulingId(rescheduleAppointment.id);

    const { error } = await supabase.rpc('reschedule_client_appointment', {
      p_appointment_id: rescheduleAppointment.id,
      p_appointment_date: nextDate,
      p_appointment_time: nextTime,
    });

    setReschedulingId(null);

    if (error) {
      toast({
        title: 'Erro ao remarcar',
        description: error.message || 'Não foi possível alterar o horário.',
        variant: 'destructive',
      });
      return;
    }

    const serviceNames = [
      rescheduleAppointment.service?.name,
      ...rescheduleAppointment.extraServices.map((service) => service.name),
    ].filter((serviceName): serviceName is string => Boolean(serviceName));
    const rescheduleMessage = buildAppointmentRescheduleWhatsAppMessage({
      businessName: settings.displayName,
      clientName: rescheduleAppointment.client_name,
      professionalName: rescheduleAppointment.barber?.name || settings.professionalLabel,
      serviceNames,
      previousAppointmentDate: rescheduleAppointment.appointment_date,
      previousAppointmentTime: rescheduleAppointment.appointment_time,
      appointmentDate: nextDate,
      appointmentTime: nextTime,
    });

    openAgendaWhatsAppTargets({
      professionalPhone: rescheduleAppointment.barber?.phone,
      adminPhone: settings.adminWhatsapp || settings.whatsapp,
      clientMessage: rescheduleMessage,
      adminMessage: rescheduleMessage,
    });

    toast({
      title: 'Horário remarcado',
      description: 'Seu novo horário foi salvo e o WhatsApp foi aberto para avisar a empresa.',
    });

    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === rescheduleAppointment.id
          ? {
              ...appointment,
              appointment_date: nextDate,
              appointment_time: nextTime,
            }
          : appointment,
      ),
    );
    closeRescheduleDialog();
    fetchAppointments();
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-serif text-3xl font-bold">Meus Agendamentos</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie seus horários marcados
              </p>
            </div>
            <Button onClick={() => navigate(publicBookingPath)} className="w-full sm:w-auto">
              Novo Agendamento
            </Button>
          </div>

          {appointments.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-16 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-serif text-xl font-semibold mb-2">
                  Nenhum agendamento
                </h3>
                <p className="text-muted-foreground mb-6">
                  Você ainda não tem nenhum horário marcado.
                </p>
                <Button onClick={() => navigate(publicBookingPath)}>
                  Agendar Agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {upcomingAppointments.length > 0 && (
                <div>
                  <h2 className="font-serif text-xl font-semibold mb-4">Próximos</h2>
                  <div className="space-y-4">
                    {upcomingAppointments.map((apt, index) => (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="border-border hover:border-primary/30 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={apt.status} />
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    {format(parseLocalDate(apt.appointment_date), "dd 'de' MMMM", { locale: ptBR })}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    {apt.appointment_time.slice(0, 5)}
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className="flex items-center gap-1.5">
                                      <User className="w-4 h-4 text-muted-foreground" />
                                      {apt.barber?.name}
                                    </span>
                                  </div>

                                  {/* Lista todos os serviços com preços e durações individuais */}
                                  <div className="space-y-1 mt-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="flex items-center gap-1.5">
                                        <Scissors className="w-4 h-4 text-muted-foreground" />
                                        {apt.service?.name}
                                        <span className="text-xs text-muted-foreground">({apt.service?.duration_minutes}min)</span>
                                      </span>
                                      <span className="text-muted-foreground">R$ {apt.service?.price?.toFixed(2)}</span>
                                    </div>
                                    {apt.extraServices.map((extra) => (
                                      <div key={extra.id} className="flex items-center justify-between text-sm text-primary">
                                        <span className="flex items-center gap-1.5">
                                          <span className="w-4 h-4 text-center">+</span>
                                          {extra.name}
                                          <span className="text-xs text-primary/70">({extra.duration_minutes}min)</span>
                                        </span>
                                        <span>R$ {extra.price?.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <div className="mt-2 border-t border-border pt-2 text-left sm:mt-0 sm:border-0 sm:pt-0 sm:text-right">
                                  <p className="text-xs text-muted-foreground">Total</p>
                                  <span className="font-bold text-lg">
                                    R$ {getTotalPrice(apt).toFixed(2)}
                                  </span>
                                  <p className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                                    <Clock className="w-3 h-3" /> {getTotalDuration(apt)} min
                                  </p>
                                  {apt.extraServices.length > 0 && (
                                    <p className="text-xs text-primary">{apt.extraServices.length + 1} serviços</p>
                                  )}
                                </div>
                                <div className="flex w-full flex-col gap-2 sm:w-auto">
                                  {canRescheduleAppointment(apt) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openRescheduleDialog(apt)}
                                      className="w-full"
                                    >
                                      <CalendarSync className="mr-1 h-4 w-4" />
                                      Remarcar
                                    </Button>
                                  )}
                                  {canCancelAppointment(apt) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openCancelDialog(apt)}
                                      className="w-full text-destructive hover:text-destructive"
                                    >
                                      <X className="w-4 h-4 mr-1" />
                                      Cancelar
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {pastAppointments.length > 0 && (
                <div>
                  <h2 className="font-serif text-xl font-semibold mb-4">Histórico</h2>
                  <div className="space-y-4">
                    {pastAppointments.map((apt, index) => (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="border-border opacity-70">
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <StatusBadge status={apt.status} />

                                <div className="flex items-center gap-4 text-sm flex-wrap">
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    {format(parseLocalDate(apt.appointment_date), "dd/MM/yyyy")}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    {apt.appointment_time.slice(0, 5)}
                                  </span>
                                </div>
                                <div className="space-y-0.5 mt-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>{apt.service?.name} <span className="text-xs text-muted-foreground">({apt.service?.duration_minutes}min)</span></span>
                                    <span className="text-muted-foreground">R$ {apt.service?.price?.toFixed(2)}</span>
                                  </div>
                                  {apt.extraServices.map((extra) => (
                                    <div key={extra.id} className="flex items-center justify-between text-sm text-muted-foreground">
                                      <span>+ {extra.name} <span className="text-xs">({extra.duration_minutes}min)</span></span>
                                      <span>R$ {extra.price?.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="mt-2 border-t border-border pt-2 text-left sm:mt-0 sm:border-0 sm:pt-0 sm:text-right">
                                <p className="text-xs text-muted-foreground">Total</p>
                                <span className="font-medium text-muted-foreground">
                                  R$ {getTotalPrice(apt).toFixed(2)}
                                </span>
                                <p className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                                  <Clock className="w-3 h-3" /> {getTotalDuration(apt)} min
                                </p>
                                {apt.extraServices.length > 0 && (
                                  <p className="text-xs text-muted-foreground">{apt.extraServices.length + 1} serviços</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Loyalty Progress Section */}
        {profileName && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-3xl mx-auto mt-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-xl font-semibold">Minhas Metas de Fidelidade</h2>
            </div>
            <LoyaltyTab isAdmin={false} clientName={profileName} />
          </motion.div>
        )}
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
              {cancellationNoticeHours > 0 ? ` Cancelamentos ficam disponíveis até ${cancellationNoticeHours} hora(s) antes do atendimento.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellingId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Cancelar Agendamento'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showRescheduleDialog} onOpenChange={(open) => !open && closeRescheduleDialog()}>
        <DialogContent className="max-h-[90svh] max-w-[95vw] overflow-hidden p-0 sm:max-w-3xl">
          <div className="max-h-[90svh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Remarcar agendamento</DialogTitle>
              <DialogDescription>
                O mesmo {settings.professionalLabel.toLowerCase()} e os mesmos serviços serão mantidos.
                Remarcações ficam disponíveis até {rescheduleNoticeHours} hora(s) antes do atendimento.
              </DialogDescription>
            </DialogHeader>

            {rescheduleAppointment && (
              <div className="mt-4 space-y-5">
                <div className="rounded-xl border bg-secondary/40 p-4 text-sm">
                  <p className="font-medium">{rescheduleAppointment.barber?.name}</p>
                  <p className="text-muted-foreground">
                    Horário atual: {format(parseLocalDate(rescheduleAppointment.appointment_date), "dd 'de' MMMM", { locale: ptBR })}
                    {" "}às {rescheduleAppointment.appointment_time.slice(0, 5)}
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <Label className="mb-2 block">Nova data</Label>
                    <CalendarComponent
                      mode="single"
                      selected={rescheduleDate}
                      onSelect={(date) => {
                        setRescheduleDate(date);
                        setRescheduleTime('');
                      }}
                      disabled={isDateDisabled}
                      locale={ptBR}
                      className="rounded-xl border pointer-events-auto"
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block">Novo horário</Label>
                    {!rescheduleDate ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Selecione uma data para ver os horários.
                      </p>
                    ) : rescheduleLoadingSlots ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : rescheduleAllSlots.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum horário disponível nesta data para a duração total do atendimento.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                            <span>Disponível</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-destructive"></span>
                            <span>Ocupado</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-border"></span>
                            <span>Excede horário</span>
                          </div>
                        </div>
                        <div className="grid max-h-[320px] grid-cols-3 gap-2 overflow-y-auto p-1">
                          {rescheduleAllSlots.map((slot) => {
                            const isBooked = rescheduleBookedSlots.includes(slot);
                            const isExceeded = rescheduleExceededSlots.includes(slot);
                            const isFree = !isBooked && !isExceeded;

                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => isFree && setRescheduleTime(slot)}
                                disabled={!isFree}
                                className={cn(
                                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                                  isBooked
                                    ? 'cursor-not-allowed border-destructive/30 bg-destructive/10 text-destructive opacity-60'
                                    : isExceeded
                                      ? 'cursor-not-allowed border-border bg-background text-muted-foreground opacity-50'
                                      : rescheduleTime === slot
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-emerald-500/30 bg-emerald-500/10 text-foreground hover:border-emerald-500/60'
                                )}
                              >
                                <span
                                  className={cn(
                                    'h-2 w-2 shrink-0 rounded-full',
                                    isBooked ? 'bg-destructive' : isExceeded ? 'bg-border' : 'bg-emerald-500',
                                  )}
                                ></span>
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-end">
                  <Button variant="outline" type="button" onClick={closeRescheduleDialog}>
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleRescheduleAppointment}
                    disabled={!rescheduleDate || !rescheduleTime || reschedulingId === rescheduleAppointment.id}
                  >
                    {reschedulingId === rescheduleAppointment.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Confirmar novo horário'
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
