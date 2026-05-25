/**
 * ==============================================================
 * PÁGINA: AdminDashboard (Painel Administrativo)
 * ==============================================================
 *
 * PROPÓSITO:
 * Painel de controle para administradores da barbearia.
 *
 * FUNCIONALIDADES:
 * - Visão geral com estatísticas e gráficos
 * - Listagem e filtros de agendamentos
 * - CRUD de barbeiros (com upload de foto)
 * - CRUD de serviços
 * - Marcar agendamentos como concluído/cancelado
 *
 * ACESSO:
 * Apenas usuários com role 'admin' na tabela user_roles
 *
 * ==============================================================
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, Users, Scissors, TrendingUp,
  Plus, Edit, Check, X, Loader2, Phone, Upload, Image,
  BarChart3, CalendarDays, Filter, Search, Trash2, DollarSign,
  Package, ShoppingBag, AlertCircle, CheckCircle, XCircle, Eye, EyeOff, Key,
  Trophy, MapPin, ClockIcon
} from 'lucide-react';
import { LoyaltyTab } from '@/components/admin/LoyaltyTab';
import { AppointmentQueueTab } from '@/components/admin/AppointmentQueueTab';
import { ProductSalesTab } from '@/components/admin/ProductSalesTab';
import { ClientsTab } from '@/components/admin/ClientsTab';
import { LocationsTab } from '@/components/admin/LocationsTab';
import { BusinessHoursTab } from '@/components/admin/BusinessHoursTab';
import { BrandingTab } from '@/components/admin/BrandingTab';
import { PublicPageSettingsTab } from '@/components/admin/PublicPageSettingsTab';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout } from '@/components/layout/Layout';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { supabase } from '@/integrations/supabase/client';
import { cn, parseLocalDate } from '@/lib/utils';
import { withAgendaPublicSearch } from '@/lib/agendaPublicLink';
import { playNotificationSound } from '@/lib/notificationSound';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface ExtraService {
  id: string;
  name: string;
  price: number;
  duration_minutes?: number;
}

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  appointment_type?: 'appointment' | 'queue';
  status: 'scheduled' | 'completed' | 'cancelled';
  payment_method: string | null;
  payment_status: string | null;
  barber: { name: string; id?: string; phone?: string | null };
  service: { name: string; price: number; id?: string; duration_minutes?: number };
  barber_id: string;
  service_id: string;
  created_at?: string;
  extraServices: ExtraService[];
}

interface Barber {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
  commission: number;
  user_id: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

type AppointmentRealtimeRow = {
  id?: string;
  client_name?: string;
  appointment_date?: string;
  appointment_time?: string | null;
  appointment_type?: Appointment['appointment_type'];
  status?: Appointment['status'];
};

type AppointmentServiceRealtimeRow = {
  appointment_id?: string;
  added_by_barber?: boolean;
};

type BarberRelation = { name?: string | null } | { name?: string | null }[] | null;

type AppointmentServiceRpcRow = {
  appointment_id: string;
  service_id: string;
  service_name: string;
  service_price: number | string | null;
  service_duration?: number | string | null;
};

// Cores para gráficos
const CHART_COLORS = ['hsl(220, 60%, 35%)', 'hsl(38, 80%, 55%)', 'hsl(160, 60%, 45%)', 'hsl(280, 60%, 50%)'];

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Filters
  const [filterBarber, setFilterBarber] = useState<string>('all');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [showBarberDialog, setShowBarberDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [barberName, setBarberName] = useState('');
  const [barberEmail, setBarberEmail] = useState('');
  const [barberPhone, setBarberPhone] = useState('');
  const [barberBio, setBarberBio] = useState('');
  const [barberCommission, setBarberCommission] = useState('0');
  const [barberUsername, setBarberUsername] = useState('');
  const [barberPassword, setBarberPassword] = useState('');
  const [barberPhoto, setBarberPhoto] = useState<File | null>(null);
  const [barberPhotoPreview, setBarberPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceDuration, setServiceDuration] = useState('30');
  const [servicePrice, setServicePrice] = useState('');

  // Product form fields
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('0');
  const [productCategory, setProductCategory] = useState('');
  const [productPhoto, setProductPhoto] = useState<File | null>(null);
  const [productPhotoPreview, setProductPhotoPreview] = useState<string | null>(null);

  const { user, isAdmin, loading: authLoading } = useAuth();
  const { settings } = useAgendaBranding();
  const publicBookingPath = withAgendaPublicSearch('/agendamento', settings);
  const { toast } = useToast();
  const { requestPermission, sendNotification, permission } = usePushNotifications();
  const navigate = useNavigate();

  // Request notification permission on mount
  useEffect(() => {
    if (isAdmin && permission !== 'granted') {
      requestPermission();
    }
  }, [isAdmin, permission, requestPermission]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      setLoading(false);
      return;
    }

    if (!settings.storeAccountId) {
      setLoading(false);
      return;
    }

    fetchAllData();

      // Subscribe to realtime changes in appointments
      const appointmentsChannel = supabase
        .channel('admin-appointments-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'appointments',
            filter: `store_account_id=eq.${settings.storeAccountId}`,
          },
          (payload) => {
            const newApt = payload.new as AppointmentRealtimeRow;
            fetchAppointments();

            // In-app toast notification
            toast({
              title: '🔔 Novo Agendamento',
              description: `${newApt.client_name} agendou para ${format(parseLocalDate(newApt.appointment_date), "dd/MM")} às ${newApt.appointment_time?.slice(0, 5)}`,
            });

            // Browser push notification (works even when tab is not focused)
            sendNotification('🔔 Novo Agendamento', {
              body: `${newApt.client_name} agendou para ${format(parseLocalDate(newApt.appointment_date), "dd/MM")} às ${newApt.appointment_time?.slice(0, 5)}`,
              tag: `appointment-${newApt.id}`,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'appointments',
            filter: `store_account_id=eq.${settings.storeAccountId}`,
          },
          (payload) => {
            const updatedApt = payload.new as AppointmentRealtimeRow;
            const oldApt = payload.old as AppointmentRealtimeRow;

            // Otimista: remove/atualiza imediatamente em tela
            if (updatedApt?.id) {
              setAppointments((prev) =>
                prev.map((a) =>
                  a.id === updatedApt.id
                    ? {
                        ...a,
                        status: updatedApt.status,
                        appointment_date: updatedApt.appointment_date ?? a.appointment_date,
                        appointment_time: updatedApt.appointment_time ?? a.appointment_time,
                        appointment_type: updatedApt.appointment_type ?? a.appointment_type,
                        client_name: updatedApt.client_name ?? a.client_name,
                        client_phone: updatedApt.client_phone ?? a.client_phone,
                      }
                    : a
                )
              );
            }

            fetchAppointments();

            if (oldApt.status !== 'cancelled' && updatedApt.status === 'cancelled') {
              playNotificationSound();
              toast({
                title: '❌ Agendamento Cancelado',
                description: `${updatedApt.client_name} cancelou o agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)}.`,
                variant: 'destructive',
              });

              // Browser push notification for cancellation
              sendNotification('❌ Agendamento Cancelado', {
                body: `${updatedApt.client_name} cancelou o agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)}`,
                tag: `cancellation-${updatedApt.id}`,
              });
            } else if (oldApt.status !== 'completed' && updatedApt.status === 'completed') {
              // Notifica quando barbeiro conclui um agendamento
              toast({
                title: '✅ Agendamento Concluído',
                description: `${updatedApt.client_name} foi atendido.`,
              });
              sendNotification('✅ Agendamento Concluído', {
                body: `${updatedApt.client_name} - agendamento de ${format(parseLocalDate(updatedApt.appointment_date), "dd/MM")} às ${updatedApt.appointment_time?.slice(0, 5)} foi concluído.`,
                tag: `completed-${updatedApt.id}`,
              });
            }
          }
        )
        .subscribe();

      // Also listen for appointment_services changes (extra services added)
      const servicesChannel = supabase
        .channel('admin-appointment-services-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'appointment_services',
            filter: `store_account_id=eq.${settings.storeAccountId}`,
          },
          async (payload) => {
            const newService = payload.new as AppointmentServiceRealtimeRow;

            // Buscar dados do agendamento e barbeiro para notificar
            const { data: aptData } = await supabase
              .from('appointments')
              .select('client_name, barber_id, barbers(name)')
              .eq('id', newService.appointment_id)
              .single();

            if (aptData && newService.added_by_barber) {
              const barberRelation = aptData.barbers as BarberRelation;
              const barberName = Array.isArray(barberRelation)
                ? barberRelation[0]?.name
                : barberRelation?.name || settings.professionalLabel;
              const clientName = aptData.client_name;

              // Buscar nome do serviço adicionado
              const { data: serviceData } = await supabase
                .from('services')
                .select('name')
                .eq('id', newService.service_id)
                .single();

              const serviceName = serviceData?.name || 'serviço';

              toast({
                title: '✂️ Serviço Adicionado',
                description: `${barberName} adicionou "${serviceName}" para ${clientName}`,
              });

              sendNotification('✂️ Serviço Adicionado', {
                body: `${barberName} adicionou "${serviceName}" para ${clientName}`,
                tag: `service-added-${newService.id}`,
              });
            }

            fetchAppointments();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'appointment_services',
            filter: `store_account_id=eq.${settings.storeAccountId}`,
          },
          () => {
            fetchAppointments();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'appointment_services',
            filter: `store_account_id=eq.${settings.storeAccountId}`,
          },
          () => {
            fetchAppointments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(appointmentsChannel);
        supabase.removeChannel(servicesChannel);
      };
  }, [authLoading, isAdmin, settings.storeAccountId]);

  const confirmAppointmentPayment = async (appointmentId: string) => {
    const { error } = await supabase.rpc('confirm_agenda_appointment_payment', {
      p_appointment_id: appointmentId,
    });

    if (error) {
      toast({
        title: 'Erro ao confirmar pagamento',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Pagamento confirmado',
      description: 'O agendamento foi marcado como pago.',
    });
    fetchAppointments();
  };

  const fetchAllData = async () => {
    await Promise.all([fetchAppointments(), fetchBarbers(), fetchServices(), fetchProducts()]);
    setLoading(false);
  };

  const fetchAppointments = async () => {
    if (!settings.storeAccountId) return;
    const { data } = await supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        client_phone,
        appointment_date,
        appointment_time,
        appointment_type,
        created_at,
        status,
        payment_method,
        payment_status,
        barber_id,
        service_id,
        barber:barbers(id, name, phone),
        service:services(id, name, price, duration_minutes)
      `)
      .eq('store_account_id', settings.storeAccountId)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (data) {
      // Buscar serviços extras via RPC (evita dependência de FK e mantém a soma correta)
      const appointmentIds = data.map((a) => a.id);
      const extraServicesMap: Record<string, ExtraService[]> = {};

      if (appointmentIds.length > 0) {
        const { data: extraData, error: extraError } = await supabase
          .rpc('get_appointment_extra_services', { p_appointment_ids: appointmentIds });

        if (!extraError && extraData) {
          (extraData as AppointmentServiceRpcRow[]).forEach((e) => {
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
        barber: apt.barber as unknown as { name: string; id?: string },
        service: apt.service as unknown as { name: string; price: number; id?: string; duration_minutes?: number },
        extraServices: extraServicesMap[apt.id] || [],
      }));
      setAppointments(formatted);
    }
  };

  const fetchBarbers = async () => {
    if (!settings.storeAccountId) return;
    const { data } = await supabase
      .from('barbers')
      .select('*')
      .eq('store_account_id', settings.storeAccountId)
      .order('name');
    if (data) setBarbers(data);
  };

  const fetchServices = async () => {
    if (!settings.storeAccountId) return;
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('store_account_id', settings.storeAccountId)
      .order('name');
    if (data) setServices(data);
  };

  const fetchProducts = async () => {
    if (!settings.storeAccountId) return;
    const { data } = await supabase
      .from('agenda_products')
      .select('*')
      .eq('store_account_id', settings.storeAccountId)
      .order('name');
    if (data) setProducts(data);
  };

  // Calcula o preço total de um agendamento incluindo serviços extras
  const getAppointmentTotalPrice = (apt: Appointment) => {
    const extrasTotal = apt.extraServices.reduce((sum, s) => sum + (s.price || 0), 0);
    return (apt.service?.price || 0) + extrasTotal;
  };

  // Calcula a duração total de um agendamento incluindo serviços extras
  const getAppointmentTotalDuration = (apt: Appointment) => {
    const extrasDuration = apt.extraServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    return (apt.service?.duration_minutes || 0) + extrasDuration;
  };

  // Stats
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // Agendamentos na semana (apenas scheduled, para ver o que vem)
  const weeklyAppointments = appointments.filter(a => {
    const date = parseLocalDate(a.appointment_date);
    return isWithinInterval(date, { start: weekStart, end: weekEnd }) && a.status === 'scheduled';
  });

  // Todos agendamentos do mês (não cancelados)
  const monthlyAppointments = appointments.filter(a => {
    const date = parseLocalDate(a.appointment_date);
    return isWithinInterval(date, { start: monthStart, end: monthEnd }) && a.status !== 'cancelled';
  });

  // Apenas concluídos do mês para cálculo de faturamento real
  const monthlyCompletedAppointments = appointments.filter(a => {
    const date = parseLocalDate(a.appointment_date);
    return isWithinInterval(date, { start: monthStart, end: monthEnd }) && a.status === 'completed';
  });

  // Faturamento semanal: apenas concluídos (incluindo serviços extras)
  const weeklyCompletedAppointments = appointments.filter(a => {
    const date = parseLocalDate(a.appointment_date);
    return isWithinInterval(date, { start: weekStart, end: weekEnd }) && a.status === 'completed';
  });
  const weeklyRevenue = weeklyCompletedAppointments.reduce((sum, a) => sum + getAppointmentTotalPrice(a), 0);

  // Faturamento mensal: apenas concluídos (incluindo serviços extras)
  const monthlyRevenue = monthlyCompletedAppointments.reduce((sum, a) => sum + getAppointmentTotalPrice(a), 0);

  const todayAppointments = appointments.filter(
    a => a.appointment_date === format(today, 'yyyy-MM-dd') && a.status === 'scheduled'
  );

  // Dados para gráficos
  const getLast7DaysData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayAppointments = appointments.filter(
        a => a.appointment_date === dateStr && a.status !== 'cancelled'
      );
      const revenue = dayAppointments.reduce((sum, a) => sum + getAppointmentTotalPrice(a), 0);
      data.push({
        name: format(date, 'EEE', { locale: ptBR }),
        agendamentos: dayAppointments.length,
        faturamento: revenue,
      });
    }
    return data;
  };

  const getServiceDistribution = () => {
    const distribution: Record<string, number> = {};
    monthlyAppointments.forEach(a => {
      const serviceName = a.service?.name || 'Outro';
      distribution[serviceName] = (distribution[serviceName] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  };

  const getBarberPerformance = () => {
    const performance: Record<string, { count: number; revenue: number }> = {};
    // Filtrar apenas agendamentos concluídos para o gráfico de desempenho
    const completedOnly = appointments.filter(a => {
      const date = parseLocalDate(a.appointment_date);
      return isWithinInterval(date, { start: monthStart, end: monthEnd }) && a.status === 'completed';
    });
    completedOnly.forEach(a => {
      const barberName = a.barber?.name || 'Outro';
      if (!performance[barberName]) {
        performance[barberName] = { count: 0, revenue: 0 };
      }
      performance[barberName].count += 1;
      performance[barberName].revenue += getAppointmentTotalPrice(a);
    });
    // Ordenar do maior para o menor
    return Object.entries(performance)
      .map(([name, data]) => ({
        name,
        agendamentos: data.count,
        faturamento: data.revenue,
      }))
      .sort((a, b) => b.agendamentos - a.agendamentos);
  };

  // Cálculo de comissões por barbeiro
  const getBarberCommissions = () => {
    const commissions: Record<string, { barber: Barber; totalServices: number; totalCommission: number; totalRevenue: number }> = {};

    // Apenas agendamentos concluídos do mês
    monthlyCompletedAppointments.forEach(apt => {
      const barber = barbers.find(b => b.id === apt.barber_id);
      if (!barber) return;

      if (!commissions[barber.id]) {
        commissions[barber.id] = {
          barber,
          totalServices: 0,
          totalCommission: 0,
          totalRevenue: 0
        };
      }

      // Contar serviço principal + extras
      const extrasCount = apt.extraServices.length;
      const servicesCount = 1 + extrasCount;

      commissions[barber.id].totalServices += servicesCount;
      commissions[barber.id].totalCommission += servicesCount * (barber.commission || 0);
      commissions[barber.id].totalRevenue += getAppointmentTotalPrice(apt);
    });

    return Object.values(commissions).sort((a, b) => b.totalCommission - a.totalCommission);
  };

  // Filtered appointments
  const filteredAppointments = appointments.filter(apt => {
    const matchesBarber = filterBarber === 'all' || apt.barber_id === filterBarber;
    const matchesService = filterService === 'all' || apt.service_id === filterService;
    const matchesStatus = filterStatus === 'all' || apt.status === filterStatus;
    const matchesSearch = !searchTerm ||
      apt.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.client_phone?.includes(searchTerm);

    return matchesBarber && matchesService && matchesStatus && matchesSearch;
  });

  // Handlers
  const updateAppointmentStatus = async (id: string, status: 'completed' | 'cancelled') => {
    // Otimista: atualiza imediatamente no estado local (remove da aba "agendados" na hora)
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));

    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
      // Recarrega para reverter caso o update falhe
      fetchAppointments();
    } else {
      toast({ title: 'Atualizado', description: `Status alterado para ${status === 'completed' ? 'concluído' : 'cancelado'}.` });
      fetchAppointments();
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBarberPhoto(file);
      const reader = new FileReader();
      reader.onload = () => {
        setBarberPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadBarberPhoto = async (barberId: string): Promise<string | null> => {
    if (!barberPhoto) return null;

    const fileExt = barberPhoto.name.split('.').pop();
    const fileName = `${barberId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('barber-photos')
      .upload(fileName, barberPhoto);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('barber-photos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const openBarberDialog = (barber?: Barber) => {
    if (barber) {
      setEditingBarber(barber);
      setBarberName(barber.name);
      setBarberEmail(barber.email || '');
      setBarberPhone(barber.phone || '');
      setBarberBio(barber.bio || '');
      setBarberCommission(String(barber.commission || 0));
      setBarberPhotoPreview(barber.photo_url);
      setBarberUsername('');
      setBarberPassword('');
    } else {
      setEditingBarber(null);
      setBarberName('');
      setBarberEmail('');
      setBarberPhone('');
      setBarberBio('');
      setBarberCommission('0');
      setBarberPhotoPreview(null);
      setBarberUsername('');
      setBarberPassword('');
    }
    setBarberPhoto(null);
    setShowBarberDialog(true);
  };

  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductName(product.name);
      setProductDescription(product.description || '');
      setProductPrice(String(product.price));
      setProductStock(String(product.stock_quantity));
      setProductCategory(product.category || '');
      setProductPhotoPreview(product.image_url);
    } else {
      setEditingProduct(null);
      setProductName('');
      setProductDescription('');
      setProductPrice('');
      setProductStock('0');
      setProductCategory('');
      setProductPhotoPreview(null);
    }
    setProductPhoto(null);
    setShowProductDialog(true);
  };

  const openServiceDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceName(service.name);
      setServiceDescription(service.description || '');
      setServiceDuration(String(service.duration_minutes));
      setServicePrice(String(service.price));
    } else {
      setEditingService(null);
      setServiceName('');
      setServiceDescription('');
      setServiceDuration('30');
      setServicePrice('');
    }
    setShowServiceDialog(true);
  };

  // Password validation regex
  const passwordRegex = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

  const saveBarber = async () => {
    if (!barberName.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }

    // Validate credentials if provided
    if (barberUsername || barberPassword) {
      if (!barberUsername || !barberPassword) {
        toast({ title: 'Erro', description: 'Para criar credenciais, preencha usuário e senha.', variant: 'destructive' });
        return;
      }
      if (barberUsername.length < 3) {
        toast({ title: 'Erro', description: 'Usuário deve ter no mínimo 3 caracteres.', variant: 'destructive' });
        return;
      }
      if (!passwordRegex.test(barberPassword)) {
        toast({ title: 'Erro', description: 'Senha deve ter mínimo 8 caracteres, 1 maiúscula e 1 símbolo.', variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);

    let photoUrl = editingBarber?.photo_url || null;

    // Upload da foto se houver nova
    if (barberPhoto) {
      const barberId = editingBarber?.id || crypto.randomUUID();
      const uploadedUrl = await uploadBarberPhoto(barberId);
      if (uploadedUrl) {
        photoUrl = uploadedUrl;
      }
    }

    const barberData = {
      name: barberName,
      email: barberEmail || null,
      phone: barberPhone || null,
      bio: barberBio || null,
      photo_url: photoUrl,
      commission: parseFloat(barberCommission) || 0,
    };

    let savedBarberId: string | null = null;

    if (editingBarber) {
      const { error } = await supabase
        .from('barbers')
        .update(barberData)
        .eq('id', editingBarber.id);

      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      savedBarberId = editingBarber.id;
      toast({ title: 'Sucesso', description: `${settings.professionalLabel} atualizado.` });
    } else {
      const { data, error } = await supabase
        .from('barbers')
        .insert(barberData)
        .select('id')
        .single();

      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível cadastrar.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      savedBarberId = data.id;
      toast({ title: 'Sucesso', description: `${settings.professionalLabel} cadastrado.` });
    }

    // Set credentials if provided
    if (barberUsername && barberPassword && savedBarberId) {
      const { data: credResult, error: credError } = await supabase.rpc('set_barber_password', {
        p_barber_id: savedBarberId,
        p_username: barberUsername,
        p_password: barberPassword
      });

      if (credError) {
        toast({ title: 'Aviso', description: `${settings.professionalLabel} salvo, mas erro ao definir credenciais.`, variant: 'destructive' });
      } else {
        toast({ title: 'Credenciais definidas', description: `Usuário: ${barberUsername}` });
      }
    }

    setSubmitting(false);
    setShowBarberDialog(false);
    setBarberPhoto(null);
    setBarberPhotoPreview(null);
    setBarberUsername('');
    setBarberPassword('');
    fetchBarbers();
  };

  const saveService = async () => {
    if (!serviceName.trim() || !servicePrice) {
      toast({ title: 'Erro', description: 'Nome e preço são obrigatórios.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const serviceData = {
      name: serviceName,
      description: serviceDescription || null,
      duration_minutes: parseInt(serviceDuration),
      price: parseFloat(servicePrice),
    };

    if (editingService) {
      const { error } = await supabase
        .from('services')
        .update(serviceData)
        .eq('id', editingService.id);

      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: `${settings.serviceLabel} atualizado.` });
      }
    } else {
      const { error } = await supabase
        .from('services')
        .insert(serviceData);

      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível cadastrar.', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: `${settings.serviceLabel} cadastrado.` });
      }
    }

    setSubmitting(false);
    setShowServiceDialog(false);
    fetchServices();
  };

  const toggleBarberActive = async (barber: Barber) => {
    const { error } = await supabase
      .from('barbers')
      .update({ is_active: !barber.is_active })
      .eq('id', barber.id);

    if (!error) {
      toast({ title: 'Atualizado', description: `${settings.professionalLabel} ${barber.is_active ? 'desativado' : 'ativado'}.` });
      fetchBarbers();
    }
  };

  const toggleServiceActive = async (service: Service) => {
    const { error } = await supabase
      .from('services')
      .update({ is_active: !service.is_active })
      .eq('id', service.id);

    if (!error) {
      toast({ title: 'Atualizado', description: `${settings.serviceLabel} ${service.is_active ? 'desativado' : 'ativado'}.` });
      fetchServices();
    }
  };

  const deleteBarber = async (barber: Barber) => {
    if (!confirm(`Tem certeza que deseja excluir ${settings.professionalLabel.toLowerCase()} "${barber.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const { error } = await supabase
      .from('barbers')
      .delete()
      .eq('id', barber.id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir. Verifique se não há agendamentos vinculados.', variant: 'destructive' });
    } else {
      toast({ title: 'Excluído', description: `${settings.professionalLabel} excluído com sucesso.` });
      fetchBarbers();
    }
  };

  const deleteService = async (service: Service) => {
    if (!confirm(`Tem certeza que deseja excluir ${settings.serviceLabel.toLowerCase()} "${service.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', service.id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir. Verifique se não há agendamentos vinculados.', variant: 'destructive' });
    } else {
      toast({ title: 'Excluído', description: `${settings.serviceLabel} excluído com sucesso.` });
      fetchServices();
    }
  };

  // Product handlers
  const handleProductPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductPhoto(file);
      const reader = new FileReader();
      reader.onload = () => {
        setProductPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProductPhoto = async (productId: string): Promise<string | null> => {
    if (!productPhoto) return null;

    const fileExt = productPhoto.name.split('.').pop();
    const fileName = `${productId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, productPhoto);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const saveProduct = async () => {
    if (!productName.trim() || !productPrice) {
      toast({ title: 'Erro', description: 'Nome e preço são obrigatórios.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    let imageUrl = editingProduct?.image_url || null;

    if (productPhoto) {
      const productId = editingProduct?.id || crypto.randomUUID();
      const uploadedUrl = await uploadProductPhoto(productId);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      }
    }

    const productData = {
      name: productName,
      description: productDescription || null,
      price: parseFloat(productPrice),
      stock_quantity: parseInt(productStock) || 0,
      category: productCategory || "",
      image_url: imageUrl,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('agenda_products')
        .update(productData)
        .eq('id', editingProduct.id);

      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Produto atualizado.' });
      }
    } else {
      const { error } = await supabase
        .from('agenda_products')
        .insert(productData);

      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível cadastrar.', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Produto cadastrado.' });
      }
    }

    setSubmitting(false);
    setShowProductDialog(false);
    setProductPhoto(null);
    setProductPhotoPreview(null);
    fetchProducts();
  };

  const toggleProductActive = async (product: Product) => {
    const { error } = await supabase
      .from('agenda_products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);

    if (!error) {
      toast({ title: 'Atualizado', description: `Produto ${product.is_active ? 'desativado' : 'ativado'}.` });
      fetchProducts();
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${product.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const { error } = await supabase
      .from('agenda_products')
      .delete()
      .eq('id', product.id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir.', variant: 'destructive' });
    } else {
      toast({ title: 'Excluído', description: 'Produto excluído com sucesso.' });
      fetchProducts();
    }
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

  if (!isAdmin) return null;

  const chartConfig = {
    agendamentos: { label: 'Agendamentos', color: 'hsl(220, 60%, 35%)' },
    faturamento: { label: 'Faturamento', color: 'hsl(38, 80%, 55%)' },
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-3xl font-bold">Dashboard Administrativo</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie {settings.displayName}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">Visão Geral</TabsTrigger>
              <TabsTrigger value="queue" className="text-xs sm:text-sm px-2 sm:px-3">Fila</TabsTrigger>
              <TabsTrigger value="appointments" className="text-xs sm:text-sm px-2 sm:px-3">Agendamentos</TabsTrigger>
              <TabsTrigger value="commissions" className="text-xs sm:text-sm px-2 sm:px-3">Comissões</TabsTrigger>
              <TabsTrigger value="barbers" className="text-xs sm:text-sm px-2 sm:px-3">{settings.professionalLabel}</TabsTrigger>
              <TabsTrigger value="services" className="text-xs sm:text-sm px-2 sm:px-3">{settings.serviceLabel}</TabsTrigger>
              <TabsTrigger value="products" className="text-xs sm:text-sm px-2 sm:px-3">Produtos</TabsTrigger>
              <TabsTrigger value="product-sales" className="text-xs sm:text-sm px-2 sm:px-3">Vendas</TabsTrigger>
              <TabsTrigger value="clients" className="text-xs sm:text-sm px-2 sm:px-3">Clientes</TabsTrigger>
              <TabsTrigger value="loyalty" className="text-xs sm:text-sm px-2 sm:px-3">Fidelidade</TabsTrigger>
              <TabsTrigger value="locations" className="text-xs sm:text-sm px-2 sm:px-3">Localizações</TabsTrigger>
              <TabsTrigger value="hours" className="text-xs sm:text-sm px-2 sm:px-3">Horários</TabsTrigger>
              <TabsTrigger value="branding" className="text-xs sm:text-sm px-2 sm:px-3">Identidade</TabsTrigger>
              <TabsTrigger value="public-page" className="text-xs sm:text-sm px-2 sm:px-3">Pagina publica</TabsTrigger>
            </TabsList>

            {/* Queue Tab */}
            <TabsContent value="queue">
              <AppointmentQueueTab
                appointments={appointments}
                onConfirmPayment={confirmAppointmentPayment}
              />
            </TabsContent>

            {/* Product Sales Tab */}
            <TabsContent value="product-sales">
              <ProductSalesTab products={products} />
            </TabsContent>

            <TabsContent value="branding">
              <BrandingTab />
            </TabsContent>

            <TabsContent value="public-page">
              <PublicPageSettingsTab />
            </TabsContent>

            <TabsContent value="overview">
              {/* Stats Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Hoje</p>
                        <p className="text-3xl font-bold text-accent">{todayAppointments.length}</p>
                        <p className="text-xs text-muted-foreground">agendamentos</p>
                      </div>
                      <div className="p-3 bg-accent/10 rounded-full">
                        <Calendar className="w-6 h-6 text-accent" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Esta Semana</p>
                        <p className="text-2xl font-bold">{weeklyAppointments.length}</p>
                        <p className="text-xs text-muted-foreground">R$ {weeklyRevenue.toFixed(0)}</p>
                      </div>
                      <div className="p-3 bg-emerald-500/10 rounded-full">
                        <CalendarDays className="w-6 h-6 text-emerald-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Este Mês</p>
                        <p className="text-2xl font-bold">{monthlyAppointments.length}</p>
                        <p className="text-xs text-muted-foreground">agendamentos</p>
                      </div>
                      <div className="p-3 bg-blue-500/10 rounded-full">
                        <BarChart3 className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Faturamento Mensal</p>
                        <p className="text-2xl font-bold text-primary">R$ {monthlyRevenue.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">{monthlyCompletedAppointments.length} concluídos</p>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full">
                        <TrendingUp className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts - Responsivo */}
              <div className="grid lg:grid-cols-2 gap-4 mb-6">
                {/* Weekly Chart */}
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <CardTitle className="font-serif text-sm sm:text-base">Últimos 7 Dias</CardTitle>
                    <CardDescription className="text-xs">Agendamentos por dia</CardDescription>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-4">
                    <ChartContainer config={chartConfig} className="h-[140px] sm:h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getLast7DaysData()} margin={{ left: 0, right: 5, top: 5, bottom: 5 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickMargin={5} />
                          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="agendamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Service Distribution */}
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <CardTitle className="font-serif text-sm sm:text-base">{settings.serviceLabel} Mais Solicitados</CardTitle>
                    <CardDescription className="text-xs">Distribuição neste mês</CardDescription>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-4">
                    {getServiceDistribution().length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">Nenhum dado ainda.</p>
                    ) : (
                      <div className="flex items-center gap-2 sm:gap-4">
                        <ChartContainer config={chartConfig} className="h-[120px] sm:h-[160px] w-[100px] sm:w-[140px] shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={getServiceDistribution()}
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={45}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {getServiceDistribution().map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                        <div className="flex-1 space-y-1 min-w-0">
                          {getServiceDistribution().slice(0, 4).map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 min-w-0">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
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

              {/* Barber Performance */}
              <Card className="mb-6 overflow-hidden">
                <CardHeader className="pb-2 p-3 sm:p-4">
                  <CardTitle className="font-serif text-sm sm:text-base">Desempenho de {settings.professionalLabel}</CardTitle>
                  <CardDescription className="text-xs">Agendamentos por {settings.professionalLabel.toLowerCase()} neste mês</CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-4">
                  <ChartContainer config={chartConfig} className="h-[120px] sm:h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getBarberPerformance()} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                        <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={70} tickLine={false} axisLine={false} tickMargin={5} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="agendamentos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Today's Appointments */}
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="font-serif text-base sm:text-lg">Agendamentos de Hoje</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  {todayAppointments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6 text-sm">
                      Nenhum agendamento para hoje.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {todayAppointments.map((apt) => {
                        const totalPrice = getAppointmentTotalPrice(apt);
                        return (
                          <div
                            key={apt.id}
                            className="p-3 sm:p-4 rounded-lg bg-secondary/50 border border-border"
                          >
                            {/* Header: Hora + Cliente + Valor */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                                <div className="text-sm sm:text-lg font-semibold shrink-0">
                                  {apt.appointment_time.slice(0, 5)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm sm:text-base truncate">{apt.client_name}</p>
                                  <p className="text-xs text-muted-foreground">{apt.barber?.name}</p>
                                  {apt.client_phone && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {apt.client_phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-semibold text-sm sm:text-base">R$ {totalPrice.toFixed(2)}</p>
                                {apt.extraServices.length > 0 && (
                                  <p className="text-xs text-primary">{apt.extraServices.length + 1} serviços</p>
                                )}
                              </div>
                            </div>

                            {/* Serviços */}
                            <div className="text-xs sm:text-sm text-muted-foreground mb-3">
                              <p>{apt.service?.name} <span className="text-foreground">(R$ {apt.service?.price?.toFixed(2)})</span></p>
                              {apt.extraServices.map((s) => (
                                <p key={s.id} className="text-primary">
                                  + {s.name} (R$ {s.price?.toFixed(2)})
                                </p>
                              ))}
                            </div>

                            {/* Botões */}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentStatus(apt.id, 'completed')}
                                className="flex-1 text-emerald-600 text-xs h-8"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Concluir
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentStatus(apt.id, 'cancelled')}
                                className="flex-1 text-destructive text-xs h-8"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appointments">
              {/* Status Summary Cards */}
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <Card className="cursor-pointer hover:ring-2 ring-accent transition-all" onClick={() => setFilterStatus('scheduled')}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-full">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{appointments.filter(a => a.status === 'scheduled').length}</p>
                        <p className="text-sm text-muted-foreground">Agendados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:ring-2 ring-emerald-500 transition-all" onClick={() => setFilterStatus('completed')}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-full">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">{appointments.filter(a => a.status === 'completed').length}</p>
                        <p className="text-sm text-muted-foreground">Concluídos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:ring-2 ring-destructive transition-all" onClick={() => setFilterStatus('cancelled')}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-destructive/10 rounded-full">
                        <XCircle className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-destructive">{appointments.filter(a => a.status === 'cancelled').length}</p>
                        <p className="text-sm text-muted-foreground">Cancelados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    {filterStatus === 'scheduled' ? 'Agendamentos Abertos' :
                     filterStatus === 'completed' ? 'Agendamentos Concluídos' :
                     filterStatus === 'cancelled' ? 'Agendamentos Cancelados' : 'Todos os Agendamentos'}
                  </CardTitle>
                  <CardDescription>
                    {filteredAppointments.length} agendamentos encontrados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={filterBarber} onValueChange={setFilterBarber}>
                      <SelectTrigger>
                        <SelectValue placeholder={settings.professionalLabel} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        <SelectItem value="all">Todos</SelectItem>
                        {barbers.filter(b => b.is_active).map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterService} onValueChange={setFilterService}>
                      <SelectTrigger>
                        <SelectValue placeholder={settings.serviceLabel} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        <SelectItem value="all">Todos</SelectItem>
                        {services.filter(s => s.is_active).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilterBarber('all');
                        setFilterService('all');
                        setFilterStatus('all');
                        setSearchTerm('');
                      }}
                    >
                      Limpar Filtros
                    </Button>
                  </div>

                  {/* Appointments - Mobile (sem rolagem lateral) */}
                  <div className="sm:hidden space-y-3">
                    {filteredAppointments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum agendamento encontrado.
                      </div>
                    ) : (
                      filteredAppointments.map((apt) => {
                        const totalPrice = getAppointmentTotalPrice(apt);
                        const totalDuration = getAppointmentTotalDuration(apt);
                        return (
                          <div key={apt.id} className={cn(
                            "p-4 rounded-lg border bg-secondary/30",
                            apt.status === 'cancelled' && "opacity-60"
                          )}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {format(new Date(apt.appointment_date), "dd/MM/yyyy")} • {apt.appointment_time.slice(0, 5)}
                                </p>
                                <p className="text-sm mt-1 truncate"><span className="font-medium">{apt.client_name}</span></p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {apt.barber?.name}
                                </p>
                                <div className="mt-2">
                                  <p className="text-sm">{apt.service?.name} <span className="text-muted-foreground">(R$ {apt.service?.price?.toFixed(2)})</span></p>
                                  {apt.extraServices.length > 0 && apt.extraServices.map(s => (
                                    <p key={s.id} className="text-xs text-primary">
                                      + {s.name} (R$ {s.price?.toFixed(2)})
                                    </p>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <div className="text-right">
                                  <p className="text-sm font-semibold">R$ {totalPrice.toFixed(2)}</p>
                                  <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                    <Clock className="w-3 h-3" /> {totalDuration} min
                                  </p>
                                  {apt.extraServices.length > 0 && (
                                    <p className="text-xs text-primary">{apt.extraServices.length + 1} serviços</p>
                                  )}
                                </div>
                                <StatusBadge status={apt.status} />
                                {apt.status === 'scheduled' && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateAppointmentStatus(apt.id, 'completed')}
                                      className="text-emerald-600"
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateAppointmentStatus(apt.id, 'cancelled')}
                                      className="text-destructive"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                                {apt.status === 'cancelled' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(publicBookingPath)}
                                    className="gap-1"
                                  >
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    Encaixe
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Appointments - Desktop */}
                  <div className="hidden sm:block rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Data/Hora</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                          <TableHead>{settings.serviceLabel}</TableHead>
                          <TableHead>{settings.professionalLabel}</TableHead>
                          <TableHead>Valor Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right w-[120px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAppointments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              Nenhum agendamento encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAppointments.map((apt) => {
                            const totalPrice = getAppointmentTotalPrice(apt);
                            const totalDuration = getAppointmentTotalDuration(apt);
                            return (
                              <TableRow key={apt.id} className={apt.status === 'cancelled' ? 'opacity-60' : ''}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-xs sm:text-sm">{format(new Date(apt.appointment_date), "dd/MM/yyyy")}</p>
                                    <p className="text-xs sm:text-sm text-muted-foreground">{apt.appointment_time.slice(0, 5)}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium text-xs sm:text-sm">{apt.client_name}</TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  {apt.client_phone ? (
                                    <span className="flex items-center gap-1 text-xs">
                                      <Phone className="w-3 h-3" />
                                      {apt.client_phone}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="text-xs sm:text-sm">{apt.service?.name} <span className="text-muted-foreground">(R$ {apt.service?.price?.toFixed(2)})</span></p>
                                    {apt.extraServices.length > 0 && apt.extraServices.map(s => (
                                      <p key={s.id} className="text-xs text-primary">
                                        + {s.name} (R$ {s.price?.toFixed(2)})
                                      </p>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm">{apt.barber?.name}</TableCell>
                                <TableCell>
                                  <div>
                                    <span className="font-medium text-xs sm:text-sm">R$ {totalPrice.toFixed(2)}</span>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {totalDuration} min
                                    </p>
                                    {apt.extraServices.length > 0 && (
                                      <p className="text-xs text-primary">{apt.extraServices.length + 1} serviços</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={apt.status} />
                                </TableCell>
                                <TableCell className="text-right">
                                  {apt.status === 'scheduled' && (
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => updateAppointmentStatus(apt.id, 'completed')}
                                        title="Marcar como concluído"
                                      >
                                        <Check className="w-4 h-4 text-emerald-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => updateAppointmentStatus(apt.id, 'cancelled')}
                                        title="Cancelar agendamento"
                                      >
                                        <X className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  )}
                                  {apt.status === 'cancelled' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => navigate(publicBookingPath)}
                                      title="Criar encaixe neste horario liberado"
                                    >
                                      <CalendarDays className="w-4 h-4 text-primary" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Monthly Summary */}
                  <div className="mt-6 p-4 rounded-lg bg-secondary/30 border border-border">
                    <h3 className="font-semibold mb-3">Resumo do Mês ({format(today, 'MMMM yyyy', { locale: ptBR })})</h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Agendamentos</p>
                        <p className="text-xl font-bold">{monthlyAppointments.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Concluídos</p>
                        <p className="text-xl font-bold text-emerald-600">
                          {appointments.filter(a => {
                            const date = new Date(a.appointment_date);
                            return isWithinInterval(date, { start: monthStart, end: monthEnd }) && a.status === 'completed';
                          }).length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Faturamento Estimado</p>
                        <p className="text-xl font-bold text-primary">R$ {monthlyRevenue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Comissões */}
            <TabsContent value="commissions">
              <div className="space-y-6">
                {/* Resumo Geral */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total a Pagar</p>
                          <p className="text-2xl font-bold text-primary">
                            R$ {getBarberCommissions().reduce((sum, c) => sum + c.totalCommission, 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">neste mês</p>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-full">
                          <DollarSign className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{settings.serviceLabel} Concluídos</p>
                          <p className="text-2xl font-bold">
                            {getBarberCommissions().reduce((sum, c) => sum + c.totalServices, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">no mês</p>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-full">
                          <Scissors className="w-6 h-6 text-emerald-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Faturamento Bruto</p>
                          <p className="text-2xl font-bold">
                            R$ {getBarberCommissions().reduce((sum, c) => sum + c.totalRevenue, 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">concluídos</p>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-full">
                          <TrendingUp className="w-6 h-6 text-blue-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Lista de Comissões por profissional */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif">Comissões por {settings.professionalLabel}</CardTitle>
                    <CardDescription>
                      {format(today, "MMMM 'de' yyyy", { locale: ptBR })} - Baseado em {settings.serviceLabel.toLowerCase()} concluídos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {getBarberCommissions().length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum {settings.serviceLabel.toLowerCase()} concluído neste mês.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {getBarberCommissions().map(({ barber, totalServices, totalCommission, totalRevenue }) => (
                          <div
                            key={barber.id}
                            className="p-4 rounded-lg bg-secondary/50 border border-border"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0">
                                {barber.photo_url ? (
                                  <img
                                    src={barber.photo_url}
                                    alt={barber.name}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-primary shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Scissors className="w-6 h-6 text-primary" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{barber.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Comissão: R$ {barber.commission?.toFixed(2)}/{settings.serviceLabel.toLowerCase()}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-2xl font-bold text-primary">
                                  R$ {totalCommission.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">a pagar</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                              <div className="text-center">
                                <p className="text-lg font-semibold">{totalServices}</p>
                                <p className="text-xs text-muted-foreground">serviços</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-semibold">R$ {totalRevenue.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">faturou</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-semibold text-emerald-600">
                                  {((totalCommission / totalRevenue) * 100 || 0).toFixed(0)}%
                                </p>
                                <p className="text-xs text-muted-foreground">comissão</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="barbers">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="font-serif">{settings.professionalLabel}</CardTitle>
                    <CardDescription>Gerencie a equipe</CardDescription>
                  </div>
                  <Button onClick={() => openBarberDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo {settings.professionalLabel}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {barbers.map((barber) => (
                      <div
                        key={barber.id}
                        className={cn(
                          "p-3 sm:p-4 rounded-lg border",
                          barber.is_active ? "bg-secondary/30 border-border" : "bg-muted/30 border-border opacity-60"
                        )}
                      >
                        {/* Mobile layout */}
                        <div className="sm:hidden space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                              {barber.photo_url ? (
                                <img src={barber.photo_url} alt={barber.name} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{barber.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Comissão: R$ {barber.commission?.toFixed(2) || '0.00'}
                              </p>
                              {!barber.is_active && <span className="text-xs text-destructive">Inativo</span>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/50">
                            <Button size="sm" variant="outline" onClick={() => openBarberDialog(barber)} className="flex-1 h-8 text-xs">
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleBarberActive(barber)}
                              className="h-8 px-2"
                            >
                              {barber.is_active ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteBarber(barber)}
                              className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 px-2"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Desktop layout */}
                        <div className="hidden sm:flex sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                              {barber.photo_url ? (
                                <img src={barber.photo_url} alt={barber.name} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-6 h-6 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{barber.name}</p>
                              <p className="text-sm text-muted-foreground break-words">
                                {barber.email && <span>{barber.email} • </span>}
                                Comissão: R$ {barber.commission?.toFixed(2) || '0.00'}
                              </p>
                              {!barber.is_active && <span className="text-xs text-destructive">Inativo</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openBarberDialog(barber)} title="Editar / redefinir senha">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleBarberActive(barber)}
                              title={barber.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {barber.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteBarber(barber)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Excluir permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="services">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
                  <div>
                    <CardTitle className="font-serif text-base sm:text-lg">{settings.serviceLabel}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Gerencie as opções oferecidas</CardDescription>
                  </div>
                  <Button onClick={() => openServiceDialog()} size="sm" className="text-xs sm:text-sm">
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">Novo {settings.serviceLabel}</span>
                    <span className="sm:hidden">Novo</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="space-y-3">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className={cn(
                          "p-3 rounded-lg border",
                          service.is_active ? 'bg-secondary/30 border-border' : 'bg-muted/30 border-border opacity-60'
                        )}
                      >
                        {/* Mobile layout */}
                        <div className="sm:hidden space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Scissors className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{service.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {service.duration_minutes} min • R$ {service.price.toFixed(2)}
                              </p>
                              {!service.is_active && <span className="text-xs text-destructive">Inativo</span>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/50">
                            <Button size="sm" variant="outline" onClick={() => openServiceDialog(service)} className="flex-1 h-8 text-xs">
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => toggleServiceActive(service)} className="h-8 px-2">
                              {service.is_active ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => deleteService(service)} className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 px-2">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Desktop layout */}
                        <div className="hidden sm:flex sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Scissors className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{service.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {service.duration_minutes} min • R$ {service.price.toFixed(2)}
                              </p>
                              {!service.is_active && <span className="text-xs text-destructive">Inativo</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openServiceDialog(service)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleServiceActive(service)} title={service.is_active ? 'Desativar' : 'Ativar'}>
                              {service.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteService(service)} className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="font-serif">Produtos</CardTitle>
                    <CardDescription>Gerencie os produtos da loja</CardDescription>
                  </div>
                  <Button onClick={() => openProductDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Produto
                  </Button>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum produto cadastrado.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className={`p-4 rounded-lg border ${
                            product.is_active ? 'bg-secondary/30 border-border' : 'bg-muted/30 border-border opacity-60'
                          }`}
                        >
                          <div className="aspect-square rounded-lg bg-secondary mb-3 overflow-hidden">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-12 h-12 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="mb-3">
                            <p className="font-medium">{product.name}</p>
                            {product.category && <p className="text-xs text-muted-foreground">{product.category}</p>}
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-bold text-primary">R$ {product.price.toFixed(2)}</span>
                              <span className="text-sm text-muted-foreground">Estoque: {product.stock_quantity}</span>
                            </div>
                            {!product.is_active && <span className="text-xs text-destructive">Inativo</span>}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openProductDialog(product)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleProductActive(product)}
                              title={product.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {product.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteProduct(product)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients">
              <ClientsTab />
            </TabsContent>

            {/* Loyalty Tab */}
            <TabsContent value="loyalty">
              <LoyaltyTab isAdmin={true} />
            </TabsContent>

            {/* Locations Tab */}
            <TabsContent value="locations">
              <LocationsTab isAdmin={true} />
            </TabsContent>

            {/* Business Hours Tab */}
            <TabsContent value="hours">
              <BusinessHoursTab isAdmin={true} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Barber Dialog with Photo Upload - Mobile Optimized */}
      <Dialog open={showBarberDialog} onOpenChange={setShowBarberDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              {editingBarber ? `Editar ${settings.professionalLabel}` : `Novo ${settings.professionalLabel}`}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Preencha os dados de {settings.professionalLabel.toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Photo Upload - Compact */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-dashed border-border shrink-0">
                {barberPhotoPreview ? (
                  <img src={barberPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                <Upload className="w-3 h-3 mr-1" />
                {barberPhotoPreview ? 'Trocar' : 'Foto'}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input value={barberName} onChange={(e) => setBarberName(e.target.value)} placeholder={`Nome do ${settings.professionalLabel.toLowerCase()}`} className="h-9" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Email</Label>
                <Input value={barberEmail} onChange={(e) => setBarberEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Telefone</Label>
                <Input value={barberPhone} onChange={(e) => setBarberPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-9 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Bio</Label>
              <Textarea value={barberBio} onChange={(e) => setBarberBio(e.target.value)} placeholder={`Descrição do ${settings.professionalLabel.toLowerCase()}`} rows={2} className="text-sm resize-none" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Comissão por {settings.serviceLabel} (R$)</Label>
              <Input
                value={barberCommission}
                onChange={(e) => setBarberCommission(e.target.value)}
                placeholder="0.00"
                type="text"
                inputMode="decimal"
                className="h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Credentials Section */}
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Credenciais de Acesso</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {editingBarber ? 'Preencha para redefinir as credenciais (deixe em branco para manter)' : `Defina login para o ${settings.professionalLabel.toLowerCase()} acessar seu painel`}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Usuário</Label>
                  <Input
                    value={barberUsername}
                    onChange={(e) => setBarberUsername(e.target.value)}
                    placeholder="usuario"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{editingBarber ? 'Nova Senha' : 'Senha'}</Label>
                  <Input
                    value={barberPassword}
                    onChange={(e) => setBarberPassword(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Mín. 8 caracteres, 1 maiúscula, 1 símbolo (!@#$%^&*...)
              </p>
              {editingBarber && (
                <p className="text-xs text-amber-600 mt-1">
                  💡 Esqueceu a senha? Preencha uma nova senha acima para redefinir.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end pt-2">
            <Button variant="outline" onClick={() => setShowBarberDialog(false)} size="sm" className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={saveBarber} disabled={submitting} size="sm" className="flex-1 sm:flex-none">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingService ? `Editar ${settings.serviceLabel}` : `Novo ${settings.serviceLabel}`}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados de {settings.serviceLabel.toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder={`Nome do ${settings.serviceLabel.toLowerCase()}`} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder={`Descrição do ${settings.serviceLabel.toLowerCase()}`} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração (minutos) *</Label>
                <Select value={serviceDuration} onValueChange={setServiceDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                    <SelectItem value="90">90 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preço (R$) *</Label>
                <Input
                  value={servicePrice}
                  onChange={(e) => setServicePrice(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)}>Cancelar</Button>
            <Button onClick={saveService} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog - Mobile Optimized */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Preencha os dados do produto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Photo Upload - Compact */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border-2 border-dashed border-border shrink-0">
                {productPhotoPreview ? (
                  <img src={productPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <input
                ref={productFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProductPhotoSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => productFileInputRef.current?.click()}
                className="text-xs"
              >
                <Upload className="w-3 h-3 mr-1" />
                {productPhotoPreview ? 'Trocar' : 'Foto'}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Nome do produto" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Descrição</Label>
              <Textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="Descrição do produto" rows={2} className="text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Preço (R$) *</Label>
                <Input
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Estoque</Label>
                <Input
                  value={productStock}
                  onChange={(e) => setProductStock(e.target.value)}
                  placeholder="0"
                  type="number"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Categoria</Label>
              <Input value={productCategory} onChange={(e) => setProductCategory(e.target.value)} placeholder="Ex: Gel, Tintas" className="h-9" />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end pt-2">
            <Button variant="outline" onClick={() => setShowProductDialog(false)} size="sm" className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={saveProduct} disabled={submitting} size="sm" className="flex-1 sm:flex-none">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
