import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Scissors, X, Loader2, Trophy } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { LoyaltyTab } from '@/components/admin/LoyaltyTab';
import { parseLocalDate } from '@/lib/utils';
import { withAgendaPublicSearch } from '@/lib/agendaPublicLink';
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
  status: 'scheduled' | 'completed' | 'cancelled';
  barber: { name: string };
  service: { name: string; price: number; duration_minutes: number };
  extraServices: ExtraService[];
}

interface AppointmentRealtimeRow {
  id?: string;
  store_account_id?: string;
  status?: Appointment['status'];
  appointment_date?: string;
  appointment_time?: string;
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

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { requestPermission, sendNotification, permission } = usePushNotifications();
  const { settings } = useAgendaBranding();
  const navigate = useNavigate();
  const publicLoginPath = withAgendaPublicSearch('/login', settings);
  const publicBookingPath = withAgendaPublicSearch('/agendamento', settings);

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
              toast({
                title: '✅ Atendimento Concluído',
                description: `Seu agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} foi concluído!`,
              });
              sendNotification('✅ Atendimento Concluído', {
                body: `Seu agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)} foi concluído!`,
                tag: `completed-${updatedApt.id}`,
              });
            } else if (oldApt.status !== 'cancelled' && updatedApt.status === 'cancelled') {
              toast({
                title: '❌ Agendamento Cancelado',
                description: `Seu agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} foi cancelado.`,
                variant: 'destructive',
              });
              sendNotification('❌ Agendamento Cancelado', {
                body: `Seu agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)} foi cancelado.`,
                tag: `cancelled-${updatedApt.id}`,
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
  }, [settings.storeAccountId, user]);

  const fetchAppointments = async () => {
    if (!user || !settings.storeAccountId) return;

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        appointment_date,
        appointment_time,
        status,
        barber:barbers(name),
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
        barber: apt.barber as unknown as { name: string },
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

    // Otimista: remove imediatamente de "Próximos" (status deixa de ser scheduled)
    setAppointments((prev) =>
      prev.map((a) => (a.id === selectedAppointment.id ? { ...a, status: 'cancelled' } : a))
    );

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', selectedAppointment.id);

    setCancellingId(null);
    setShowCancelDialog(false);

    if (error) {
      toast({
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar o agendamento.',
        variant: 'destructive',
      });

      // Recarrega para reverter caso o update falhe
      fetchAppointments();
    } else {
      toast({
        title: 'Agendamento cancelado',
        description: 'Seu agendamento foi cancelado com sucesso.',
      });
      fetchAppointments();
    }
  };

  const openCancelDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancelDialog(true);
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-3xl font-bold">Meus Agendamentos</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie seus horários marcados
              </p>
            </div>
            <Button onClick={() => navigate(publicBookingPath)}>
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
                            <div className="flex items-start justify-between">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={apt.status} />
                                </div>

                                <div className="flex items-center gap-4 text-sm">
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
                                <div className="text-right border-t border-border pt-2 mt-2 sm:border-0 sm:pt-0 sm:mt-0">
                                  <p className="text-xs text-muted-foreground">Total</p>
                                  <span className="font-bold text-lg">
                                    R$ {getTotalPrice(apt).toFixed(2)}
                                  </span>
                                  <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                    <Clock className="w-3 h-3" /> {getTotalDuration(apt)} min
                                  </p>
                                  {apt.extraServices.length > 0 && (
                                    <p className="text-xs text-primary">{apt.extraServices.length + 1} serviços</p>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openCancelDialog(apt)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Cancelar
                                </Button>
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
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <StatusBadge status={apt.status} />

                                <div className="flex items-center gap-4 text-sm flex-wrap">
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    {format(new Date(apt.appointment_date), "dd/MM/yyyy")}
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
                              <div className="text-right border-t border-border pt-2 mt-2 sm:border-0 sm:pt-0 sm:mt-0">
                                <p className="text-xs text-muted-foreground">Total</p>
                                <span className="font-medium text-muted-foreground">
                                  R$ {getTotalPrice(apt).toFixed(2)}
                                </span>
                                <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
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
    </Layout>
  );
}
