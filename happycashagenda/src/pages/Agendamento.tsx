import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, Calendar, Clock, User, ArrowRight, ArrowLeft, Check, Loader2, AlertCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { withAgendaPublicSearch } from '@/lib/agendaPublicLink';
import { PixPaymentDialog } from '@/components/booking/PixPaymentDialog';
import {
  buildAdminConfirmWhatsAppMessage,
  buildClientPaymentWhatsAppMessage,
  openAgendaWhatsAppTargets,
} from '@/lib/agendaWhatsApp';

// Validation schema for booking form
const bookingSchema = z.object({
  clientName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  clientPhone: z.string().trim().regex(/^\+?[0-9]{8,15}$/, 'Telefone inválido (8-15 dígitos)').optional().or(z.literal('')),
});

interface Barber {
  id: string;
  name: string;
  phone: string | null;
  photo_url: string | null;
  bio: string | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
}

type BookedSlotRow = {
  appointment_time: string | null;
  duration_minutes: number | null;
};

type Step = 'service' | 'barber' | 'datetime' | 'confirm';
type BookingFlow = 'appointment' | 'queue';

interface WaitingQueueItem {
  id: string;
  position: number;
  client_name: string;
  barber_name: string;
  service_name: string;
  created_at: string;
}

const SLOT_BUFFER_MINUTES = 45; // Buffer entre agendamentos

export default function Booking() {
  const [step, setStep] = useState<Step>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [bookingFlow, setBookingFlow] = useState<BookingFlow>('appointment');
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [allSlots, setAllSlots] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [exceededSlots, setExceededSlots] = useState<string[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [waitingQueue, setWaitingQueue] = useState<WaitingQueueItem[]>([]);

  const { user, loading: authLoading } = useAuth();
  const { settings } = useAgendaBranding();
  const { getAvailableTimeSlots, getAllBusinessSlots, getHoursForDay, canBookServiceAtTime } = useBusinessHours(settings.storeAccountId);
  const { toast } = useToast();
  const navigate = useNavigate();
  const publicLoginPath = withAgendaPublicSearch('/login', settings);
  const publicAppointmentsPath = withAgendaPublicSearch('/meus-agendamentos', settings);
  const canUseAppointment = settings.serviceMode !== 'walk_in';
  const canUseQueue = settings.serviceMode !== 'appointment';
  const isQueueFlow = bookingFlow === 'queue';

  // Redireciona para login se não estiver autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: 'Faça login para agendar',
        description: 'Você precisa estar logado para agendar um horário.',
        variant: 'destructive',
      });
      navigate(publicLoginPath);
    }
  }, [authLoading, navigate, publicLoginPath, toast, user]);

  useEffect(() => {
    if (settings.serviceMode === 'walk_in') {
      setBookingFlow('queue');
      if (step === 'datetime') setStep('confirm');
    } else if (settings.serviceMode === 'appointment') {
      setBookingFlow('appointment');
    }
  }, [settings.serviceMode, step]);

  useEffect(() => {
    if (settings.storeAccountId) {
      fetchServices();
      fetchBarbers();
    }
    if (user) {
      fetchUserProfile();
    }
  }, [settings.storeAccountId, user]);

  useEffect(() => {
    if (!user || !settings.storeAccountId || !settings.publicQueueVisible || !canUseQueue) {
      setWaitingQueue([]);
      return;
    }

    fetchWaitingQueue();

    const channel = supabase
      .channel(`public-waiting-queue-${settings.storeAccountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `store_account_id=eq.${settings.storeAccountId}`,
        },
        () => {
          fetchWaitingQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canUseQueue, settings.publicQueueVisible, settings.storeAccountId, user]);

  // Calculate total duration and price from selected services
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  useEffect(() => {
    if (selectedDate && selectedBarber && selectedServices.length > 0) {
      fetchAvailableSlots();
    }
  }, [selectedDate, selectedBarber, selectedServices]);

  // Realtime: atualiza slots quando há mudanças nos agendamentos do barbeiro selecionado
  useEffect(() => {
    if (!selectedBarber || !selectedDate) return;

    const channel = supabase
      .channel(`booking-slots-${selectedBarber.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `barber_id=eq.${selectedBarber.id}`,
        },
        () => {
          // Recarrega slots quando qualquer agendamento do barbeiro muda
          fetchAvailableSlots();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBarber, selectedDate, selectedServices]);

  const fetchServices = async () => {
    if (!settings.storeAccountId) return;
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('store_account_id', settings.storeAccountId)
      .eq('is_active', true)
      .order('name');
    if (data) setServices(data);
  };

  const fetchBarbers = async () => {
    if (!settings.storeAccountId) return;
    const { data } = await supabase
      .from('barbers')
      .select('*')
      .eq('store_account_id', settings.storeAccountId)
      .eq('is_active', true)
      .order('name');
    if (data) setBarbers(data);
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, username, phone')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setClientName(data.full_name || data.username || '');
      setClientPhone(data.phone || '');
    }
  };

  const fetchWaitingQueue = async () => {
    if (!settings.storeAccountId) return;
    const { data, error } = await supabase.rpc('get_public_waiting_queue', {
      p_store_account_id: settings.storeAccountId,
    });

    if (!error && data) {
      setWaitingQueue((data as WaitingQueueItem[]).map((item) => ({
        ...item,
        position: Number(item.position),
      })));
    }
  };

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !selectedBarber || selectedServices.length === 0) return;

    setLoading(true);

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Slots que cabem dentro do horário + tolerância
    const validSlots = getAvailableTimeSlots(selectedDate, totalDuration);
    // TODOS os slots do horário de funcionamento (para mostrar os "brancos")
    const allBusinessSlots = getAllBusinessSlots(selectedDate);

    const { data: booked, error: bookedError } = await supabase.rpc('get_barber_booked_slots', {
      p_barber_id: selectedBarber.id,
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
    const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = dateString === todayString;
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    // Filtrar horários passados de todos os slots
    const filterPast = (slot: string) => {
      if (!isToday) return true;
      const [h, m] = slot.split(':').map(Number);
      return h * 60 + m > currentTotalMinutes;
    };

    const filteredValidSlots = validSlots.filter(filterPast);
    const filteredAllSlots = allBusinessSlots.filter(filterPast);

    // Slots que existem no horário de funcionamento mas NÃO cabem com o serviço
    const exceededSet = new Set(
      filteredAllSlots.filter(s => !filteredValidSlots.includes(s))
    );

    const occupiedSlots: string[] = [];
    const freeSlots: string[] = [];

    filteredValidSlots.forEach((slot) => {
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

    setAllSlots([...filteredValidSlots, ...Array.from(exceededSet)].sort());
    setBookedSlots(occupiedSlots);
    setAvailableSlots(freeSlots);
    setExceededSlots(Array.from(exceededSet));
    setLoading(false);
  };

  const validateBookingForm = () => {
    if (!user) {
      toast({
        title: 'Faça login para agendar',
        description: 'Para confirmar um horário, entre com sua conta.',
        variant: 'destructive',
      });
      navigate(publicLoginPath);
      return null;
    }

    if (
      selectedServices.length === 0 ||
      !selectedBarber ||
      !clientName ||
      (!isQueueFlow && (!selectedDate || !selectedTime))
    ) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return null;
    }

    const validationResult = bookingSchema.safeParse({
      clientName,
      clientPhone: clientPhone || '',
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast({
        title: 'Dados inválidos',
        description: firstError.message,
        variant: 'destructive',
      });
      return null;
    }

    const bookingDate = selectedDate ?? new Date();
    const year = bookingDate.getFullYear();
    const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
    const day = String(bookingDate.getDate()).padStart(2, '0');

    return {
      validatedData: validationResult.data,
      dateString: `${year}-${month}-${day}`,
    };
  };

  const createBooking = async (paymentMethod: 'local' | 'pix') => {
    const payload = validateBookingForm();
    if (!payload || !selectedBarber) return;

    setSubmitting(true);

    const rpcPayload = {
      p_barber_id: selectedBarber.id,
      p_service_ids: selectedServices.map((s) => s.id),
      p_client_name: payload.validatedData.clientName.trim(),
      p_client_phone: payload.validatedData.clientPhone?.trim() || null,
      p_payment_method: paymentMethod,
      p_notes: isQueueFlow ? 'Ordem de chegada' : null,
    };

    const { data: appointmentId, error } = isQueueFlow
      ? await supabase.rpc('create_walk_in_queue_entry', rpcPayload)
      : await supabase.rpc('create_appointment_with_services', {
          ...rpcPayload,
          p_appointment_date: payload.dateString,
          p_appointment_time: `${selectedTime}:00`,
        });

    setSubmitting(false);

    if (error) {
      toast({
        title: 'Erro ao agendar',
        description: 'Não foi possível realizar o agendamento. Tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    if (paymentMethod === 'pix') {
      const whatsappPayload = {
        businessName: settings.displayName,
        clientName: payload.validatedData.clientName.trim(),
        professionalName: selectedBarber.name,
        serviceNames: selectedServices.map((s) => s.name),
        appointmentDate: payload.dateString,
        appointmentTime: isQueueFlow ? format(new Date(), 'HH:mm:ss') : `${selectedTime}:00`,
        totalAmount: totalPrice,
        paymentStatus: 'pending' as const,
      };

      openAgendaWhatsAppTargets({
        professionalPhone: selectedBarber.phone,
        adminPhone: settings.adminWhatsapp || settings.whatsapp,
        clientMessage: buildClientPaymentWhatsAppMessage(whatsappPayload),
        adminMessage: buildAdminConfirmWhatsAppMessage(whatsappPayload),
      });
    }

    toast({
      title: isQueueFlow
        ? 'Voce entrou na fila'
        : paymentMethod === 'pix' ? 'Aguardando confirmacao do Pix' : 'Agendamento confirmado!',
      description:
        isQueueFlow
          ? `${settings.displayName} recebeu sua entrada por ordem de chegada.`
          : paymentMethod === 'pix'
          ? 'Enviamos os dados pelo WhatsApp. O administrador confirmara o pagamento no painel.'
          : `${selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : ''} às ${selectedTime}. Pagamento no local.`,
    });

    if (appointmentId) {
      navigate(publicAppointmentsPath);
    }
  };

  const handleSubmit = (paymentMethod: 'local' | 'pix') => {
    const payload = validateBookingForm();
    if (!payload) return;

    if (paymentMethod === 'pix') {
      if (!settings.pixKey) {
        toast({
          title: 'Pix nao configurado',
          description: 'A empresa ainda nao cadastrou a chave Pix. Escolha pagar no local.',
          variant: 'destructive',
        });
        return;
      }
      setPixDialogOpen(true);
      return;
    }

    void createBooking('local');
  };

  const steps = [
    { key: 'service', label: settings.serviceLabel, icon: Briefcase },
    { key: 'barber', label: settings.professionalLabel, icon: User },
    ...(!isQueueFlow ? [{ key: 'datetime' as const, label: 'Data e Hora', icon: Calendar }] : []),
    { key: 'confirm', label: 'Confirmar', icon: Check },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  const canProceed = () => {
    switch (step) {
      case 'service': return selectedServices.length > 0;
      case 'barber': return !!selectedBarber;
      case 'datetime': return isQueueFlow || (!!selectedDate && !!selectedTime);
      case 'confirm': return !!clientName;
      default: return false;
    }
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex].key as Step);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex].key as Step);
    }
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;

    const dayHours = getHoursForDay(date.getDay());
    return !dayHours?.is_open;
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null; // Será redirecionado pelo useEffect
  }

  return (
    <Layout>
      <PixPaymentDialog
        open={pixDialogOpen}
        onOpenChange={setPixDialogOpen}
        pixKey={settings.pixKey}
        merchantName={settings.pixMerchantName || settings.displayName}
        amount={totalPrice}
        loading={submitting}
        onConfirmSent={() => void createBooking('pix')}
      />
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-center mb-2">
            Agendar Horário
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            {isQueueFlow
              ? `Escolha ${settings.serviceLabel.toLowerCase()} e entre na fila de atendimento`
              : `Escolha ${settings.serviceLabel.toLowerCase()}, ${settings.professionalLabel.toLowerCase()} e horário ideal para você`}
          </p>

          {settings.publicQueueVisible && canUseQueue && (
            <Card className="mb-6 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Fila de espera de hoje
                </CardTitle>
                <CardDescription>Visivel apenas para clientes logados.</CardDescription>
              </CardHeader>
              <CardContent>
                {waitingQueue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum cliente na fila agora.</p>
                ) : (
                  <div className="space-y-2">
                    {waitingQueue.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">#{item.position} - {item.client_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.service_name} com {item.barber_name}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {format(new Date(item.created_at), 'HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Progress Steps */}
          <div className="flex justify-between mb-12 relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-10" />
            {steps.map((s, index) => {
              const Icon = s.icon;
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;

              return (
                <div key={s.key} className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                      isActive && 'bg-primary border-primary text-primary-foreground',
                      isCompleted && 'bg-primary border-primary text-primary-foreground',
                      !isActive && !isCompleted && 'bg-background border-border text-muted-foreground'
                    )}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={cn(
                    'text-xs mt-2 font-medium',
                    isActive && 'text-foreground',
                    !isActive && 'text-muted-foreground'
                  )}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <Card className="border-border">
            <CardContent className="p-6">
              {step === 'service' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="font-serif">Escolha {settings.serviceLabel}</CardTitle>
                    <CardDescription>Selecione uma ou mais opções</CardDescription>
                  </CardHeader>

                  {canUseAppointment && canUseQueue && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant={bookingFlow === 'appointment' ? 'default' : 'outline'}
                        className="h-auto justify-start gap-3 p-4"
                        onClick={() => setBookingFlow('appointment')}
                      >
                        <Calendar className="h-5 w-5" />
                        <span className="text-left">Agendar horario</span>
                      </Button>
                      <Button
                        type="button"
                        variant={bookingFlow === 'queue' ? 'default' : 'outline'}
                        className="h-auto justify-start gap-3 p-4"
                        onClick={() => {
                          setBookingFlow('queue');
                          setSelectedDate(undefined);
                          setSelectedTime('');
                        }}
                      >
                        <Users className="h-5 w-5" />
                        <span className="text-left">Ordem de chegada</span>
                      </Button>
                    </div>
                  )}

                  {services.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum {settings.serviceLabel.toLowerCase()} disponível no momento.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-3">
                        {services.map((service) => {
                          const isSelected = selectedServices.some(s => s.id === service.id);
                          return (
                            <button
                              key={service.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedServices(selectedServices.filter(s => s.id !== service.id));
                                } else {
                                  setSelectedServices([...selectedServices, service]);
                                }
                              }}
                              className={cn(
                                'w-full p-4 rounded-xl border text-left transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    'w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all',
                                    isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                                  )}>
                                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                  </div>
                                  <div>
                                    <h3 className="font-semibold">{service.name}</h3>
                                    {service.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {service.description}
                                      </p>
                                    )}
                                    <p className="text-sm text-muted-foreground mt-1">
                                      <Clock className="w-3 h-3 inline mr-1" />
                                      {service.duration_minutes} min
                                    </p>
                                  </div>
                                </div>
                                <span className="font-semibold text-lg">
                                  R$ {service.price.toFixed(2)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedServices.length > 0 && (
                        <div className="mt-4 p-4 bg-primary/10 rounded-xl">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{selectedServices.length} item(ns) selecionado(s)</p>
                              <p className="text-sm text-muted-foreground">Duração total: {totalDuration} min</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-primary">R$ {totalPrice.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {step === 'barber' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="font-serif">Escolha {settings.professionalLabel}</CardTitle>
                    <CardDescription>Selecione a pessoa de sua preferência</CardDescription>
                  </CardHeader>

                  {barbers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum {settings.professionalLabel.toLowerCase()} disponível no momento.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {barbers.map((barber) => (
                        <button
                          key={barber.id}
                          onClick={() => setSelectedBarber(barber)}
                          className={cn(
                            'w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4',
                            selectedBarber?.id === barber.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                            {barber.photo_url ? (
                              <img src={barber.photo_url} alt={barber.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{barber.name}</h3>
                            {barber.bio && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {barber.bio}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 'datetime' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="font-serif">Escolha Data e Horário</CardTitle>
                    <CardDescription>Selecione um dia aberto e o horário disponível</CardDescription>
                  </CardHeader>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label className="mb-2 block">Data</Label>
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setSelectedTime('');
                        }}
                        disabled={isDateDisabled}
                        locale={ptBR}
                        className="rounded-xl border pointer-events-auto"
                      />
                    </div>

                    <div>
                      <Label className="mb-2 block">Horário</Label>
                      {!selectedDate ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                          Selecione uma data primeiro
                        </p>
                      ) : loading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : allSlots.length === 0 ? (
                        <div className="text-center py-6 space-y-3">
                          <AlertCircle className="w-8 h-8 text-primary mx-auto" />
                          <p className="text-sm text-muted-foreground">
                            Nenhum horário disponível para os serviços selecionados ({totalDuration} min).
                          </p>
                          <p className="text-sm text-primary font-medium">
                            O serviço pode ultrapassar o horário de funcionamento. Sugestão:
                          </p>
                          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                            <li>Escolha outro dia com mais horários livres</li>
                            <li>Selecione serviços com menor duração total</li>
                            <li>Escolha outro profissional</li>
                          </ul>
                          <div className="flex gap-2 justify-center mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDate(undefined);
                                setSelectedTime('');
                              }}
                            >
                              Escolher outro dia
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setStep('service');
                                setSelectedServices([]);
                                setSelectedDate(undefined);
                                setSelectedTime('');
                              }}
                            >
                              Mudar serviços
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span>Disponível</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-destructive"></span>
                              <span>Ocupado</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-border"></span>
                              <span>Excede horário</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-1">
                            {allSlots.map((slot) => {
                              const isBooked = bookedSlots.includes(slot);
                              const isExceeded = exceededSlots.includes(slot);
                              const isFree = !isBooked && !isExceeded;
                              return (
                                <button
                                  key={slot}
                                  onClick={() => isFree && setSelectedTime(slot)}
                                  disabled={isBooked || isExceeded}
                                  title={isExceeded ? `Serviço de ${totalDuration}min ultrapassa o horário de funcionamento` : undefined}
                                  className={cn(
                                    'py-2 px-3 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-2',
                                    isBooked
                                      ? 'bg-destructive/10 border-destructive/30 text-destructive cursor-not-allowed opacity-60'
                                      : isExceeded
                                        ? 'bg-background border-border text-muted-foreground cursor-not-allowed opacity-50'
                                        : selectedTime === slot
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'bg-emerald-500/10 border-emerald-500/30 text-foreground hover:border-emerald-500/60'
                                  )}
                                >
                                  <span className={cn(
                                    'w-2 h-2 rounded-full shrink-0',
                                    isBooked ? 'bg-destructive' : isExceeded ? 'bg-border' : 'bg-emerald-500'
                                  )}></span>
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                          {exceededSlots.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              ⚠️ Horários em branco: o serviço de {totalDuration}min ultrapassaria o fechamento. Escolha outro dia ou serviços de menor duração.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'confirm' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="font-serif">Confirmar Agendamento</CardTitle>
                    <CardDescription>Revise os detalhes e escolha a forma de pagamento</CardDescription>
                  </CardHeader>

                  <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                    <div>
                      <span className="text-muted-foreground text-sm">{settings.serviceLabel}</span>
                      <div className="mt-1 space-y-1">
                        {selectedServices.map(s => (
                          <div key={s.id} className="flex justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium">{s.name}</span>
                              <span className="text-muted-foreground">({s.duration_minutes}min)</span>
                            </div>
                            <span className="text-muted-foreground">R$ {s.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duração Total</span>
                      <span className="font-semibold text-primary">{totalDuration} min</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{settings.professionalLabel}</span>
                      <span className="font-medium">{selectedBarber?.name}</span>
                    </div>
                    {isQueueFlow ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Atendimento</span>
                        <span className="font-medium">Ordem de chegada</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Data</span>
                          <span className="font-medium">
                            {selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Horário</span>
                          <span className="font-medium">{selectedTime}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between pt-3 border-t border-border">
                      <span className="text-muted-foreground font-medium">Valor Total</span>
                      <span className="font-bold text-lg text-primary">
                        R$ {totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Seu nome *</Label>
                      <Input
                        id="name"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone (opcional)</Label>
                      <Input
                        id="phone"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Forma de Pagamento</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSubmit('local')}
                        disabled={!canProceed() || submitting}
                        className="h-auto py-4 flex-col gap-2"
                      >
                        {submitting ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <Clock className="w-6 h-6" />
                            <span className="text-sm">Pagar no Local</span>
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleSubmit('pix')}
                        disabled={!canProceed() || submitting}
                        className="h-auto py-4 flex-col gap-2"
                      >
                        {submitting ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-6 h-6" />
                            <span className="text-sm">Pagar via PIX</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStepIndex === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>

            {step !== 'confirm' && (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
