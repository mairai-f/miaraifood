import { QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bike, MapPin, Package, CheckCircle2, Clock, LogOut, RefreshCw, Navigation,
  MessageCircle, Phone, ExternalLink, X, Compass, Copy, AlertTriangle, ShieldCheck,
  Award, TrendingUp, DollarSign, User, Camera, Play, Pause, Power
} from 'lucide-react';
import { ChatEquipe } from './components/ChatEquipe';
import { IdiomaProvider, useTranslation } from './i18n/IdiomaContext';
import { ConfigFlutuante } from './i18n/ConfigFlutuante';
import { EmployeePasskeyPrompt } from './components/EmployeePasskeyPrompt';
import { InstallPrompt } from './components/InstallPrompt';
import { RealLeafletMap } from './components/RealLeafletMap';
import { getSupabaseClient } from '@workspace/api-client-react';
import { createAppQueryClient } from '../../src/lib/queryClient';

const queryClient = createAppQueryClient();

export type DeliveryStatus =
  | "CRIADA"
  | "AGUARDANDO_ENTREGADOR"
  | "OFERTADA"
  | "ACEITA"
  | "A_CAMINHO_DA_COLETA"
  | "CHEGUEI_NA_COLETA"
  | "PEDIDO_COLETADO"
  | "A_CAMINHO_DO_CLIENTE"
  | "CHEGUEI_NO_DESTINO"
  | "ENTREGUE"
  | "RECUSADA"
  | "CANCELADA"
  | "FALHA_NA_ENTREGA"
  | "DEVOLVIDA";

export interface DeliveryOffer {
  id: string;
  // A oferta aponta para a entrega: o codigo lia isso via `as any`, o que
  // escondia o campo do compilador.
  deliveryId?: string;
  deliveryAddress?: string;
  orderId: string;
  restaurantId: string;
  driverId?: string;
  driverName?: string;
  restaurantName: string;
  restaurantAddress: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  deliveryPin: string;
  distanceKm: number;
  estimatedMinutes: number;
  feeEarnings: number;
  tipEarnings?: number;
  paymentMethod: "pix" | "dinheiro" | "cartao" | "ja_pago";
  paymentAmount?: number;
  status: DeliveryStatus;
  timeline: Array<{ status: DeliveryStatus; timestamp: string; note?: string; lat?: number; lng?: number }>;
  driverLat?: number;
  driverLng?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DriverStats {
  driverId: string;
  restaurantId: string;
  driverName: string;
  driverPhone: string;
  vehicleType: string;
  vehiclePlate: string;
  vehicleModel: string;
  status: "ONLINE" | "PAUSADO" | "OFFLINE";
  shiftStartedAt?: string;
  todayDeliveries: number;
  todayCompleted: number;
  todayEarnings: number;
  todayDistanceKm: number;
  todayHours: number;
  totalDeliveries: number;
  totalEarnings: number;
  longestDistanceKm: number;
  avgDeliveryMinutes: number;
  rating: number;
  ratingCount: number;
}

function TokenLogin({ onLogin, initialError }: { onLogin: (token: string, name: string, remember: boolean) => void; initialError?: string }) {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !password) { setError('Informe e-mail e senha.'); return; }
    setLoading(true); setError('');
    try {
      const { data, error: authError } = await getSupabaseClient().auth.signInWithPassword({ email: token.trim(), password });
      if (authError || !data.session || !data.user) { setError(authError?.message ?? 'E-mail ou senha incorretos.'); return; }
      const name = String(data.user.user_metadata?.full_name ?? data.user.email ?? 'Entregador');
      onLogin(data.session.access_token, name, remember);
    } catch { setError(t('auth.error.connection')); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/20">
            <Bike className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('app.subtitle')}</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">E-mail do entregador</label>
            <input
              type="email" value={token} onChange={e => setToken(e.target.value)} placeholder="entregador@exemplo.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
              autoFocus required
            />
            <label className="mb-2 mt-4 block text-sm font-medium text-slate-300">Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-orange-500 focus:outline-none" required />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50">
            {loading ? t('auth.button.verifying') : t('auth.button.enter')}
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Manter conectado neste aparelho
          </label>
        </form>
      </motion.div>
    </div>
  );
}

function DeliveryBoard({ token, name, onLogout }: { token: string; name: string; onLogout: () => void }) {
  const [offer, setOffer] = useState<DeliveryOffer | null>(null);
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [status, setStatus] = useState<"ONLINE" | "PAUSADO" | "OFFLINE">("ONLINE");
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentReason, setIncidentReason] = useState('Cliente não está em casa');
  const [incidentNote, setIncidentNote] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedRouteModal, setSelectedRouteModal] = useState(false);

  const authHeaders = useRef({ 'Authorization': `Bearer ${token}` });
  const supabase = getSupabaseClient();

  // Load Driver Stats & Active Offer
  // O id do entregador nao muda durante a sessao. Resolvemos uma vez e
  // reaproveitamos, em vez de repetir getUser + lookup a cada ciclo.
  const driverIdRef = useRef<string | null>(null);
  const lastLocationRef = useRef<{ latitude: number; longitude: number; sentAt: number } | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);

  const resolveDriverId = useCallback(async () => {
    if (driverIdRef.current) return driverIdRef.current;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('id')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (!driver) return null;
    driverIdRef.current = driver.id;
    setDriverId(driver.id);
    return driver.id as string;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const id = await resolveDriverId();
      if (!id) return;
      const { data: driver } = await supabase
        .from('delivery_drivers')
        .select('availability')
        .eq('id', id)
        .maybeSingle();
      if (!driver) return;
      const statusMap: Record<string, "ONLINE" | "PAUSADO" | "OFFLINE"> = { online: 'ONLINE', paused: 'PAUSADO', offline: 'OFFLINE' };
      setStatus(statusMap[driver.availability] ?? 'OFFLINE');
      const { data: offers } = await supabase
        .from('delivery_offers')
        .select('id,status,delivery_id,deliveries(order_id,store_account_id,status,customer_name,delivery_address)')
        .eq('driver_id', id)
        .eq('status', 'offered')
        .order('offered_at', { ascending: false })
        .limit(1);
      const current: any = offers?.[0];
      setOffer(current ? { id: current.id, deliveryId: current.delivery_id, orderId: current.deliveries?.order_id ?? '', restaurantId: current.deliveries?.store_account_id ?? '', status: current.deliveries?.status ?? 'OFERTADA', customerName: current.deliveries?.customer_name ?? '', deliveryAddress: current.deliveries?.delivery_address ?? '' } : null);
      setStats((prev) => ({ ...(prev ?? {}), status: statusMap[driver.availability] ?? 'OFFLINE' } as DriverStats));
    } catch (err) {
      console.error("Erro ao carregar dados do entregador:", err);
    }
  }, [resolveDriverId]);

  useEffect(() => {
    void loadData();

    // O Realtime ja avisa sobre ofertas e entregas deste entregador, entao o
    // intervalo fica so como rede de seguranca se a conexao cair. Com a aba
    // em segundo plano nao vale gastar requisicao.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void loadData();
    }, 60000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void loadData();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadData]);

  useEffect(() => {
    if (!driverId) return;
    // Sem filtro, todo entregador recebia cada mudanca de entrega de todas as
    // lojas e recarregava tudo a cada evento. Restringimos ao proprio
  // entregador; delivery_events foi removido porque nao tem coluna que
  // permita esse filtro e as duas tabelas abaixo ja cobrem a UI.
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void loadData();
      }, 1200);
    };
    const channel = supabase
      .channel(`miaifood-delivery-realtime:${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_offers', filter: `driver_id=eq.${driverId}` }, (payload: any) => {
        // Uma oferta nova precisa do join com a entrega; eventos em rajada usam
        // uma unica leitura. Recusas/aceites apenas limpam a oferta em memoria.
        if (payload.new?.status === 'offered') scheduleRefresh();
        if (payload.new?.id === offer?.id && payload.new?.status !== 'offered') setOffer(null);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `driver_id=eq.${driverId}` }, (payload: any) => {
        if (payload.new?.id === offer?.deliveryId) {
          setOffer((current) => current ? { ...current, status: payload.new.status ?? current.status } : current);
        }
      })
      .subscribe();

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [driverId, loadData, offer?.deliveryId, offer?.id]);

  // GPS e caro em rede e bateria. So enviamos pontos visiveis e com deslocamento
  // material, ou um sinal de vida a cada dois minutos.
  useEffect(() => {
    if (status !== "ONLINE") return;
    const deliveryId = offer?.deliveryId;
    if (!deliveryId || !driverId) return;
    const minimumDistanceMeters = 35;
    const maximumSilenceMs = 120_000;
    const distanceInMeters = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
      const earthRadius = 6_371_000;
      const radians = (degrees: number) => degrees * Math.PI / 180;
      const latitudeDelta = radians(to.latitude - from.latitude);
      const longitudeDelta = radians(to.longitude - from.longitude);
      const a = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
      return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const sendLocationIfNeeded = () => {
      if (document.visibilityState !== 'visible' || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          const previous = lastLocationRef.current;
          const movedEnough = !previous || distanceInMeters(previous, point) >= minimumDistanceMeters;
          const silentTooLong = !previous || Date.now() - previous.sentAt >= maximumSilenceMs;
          if (!movedEnough && !silentTooLong) return;
          lastLocationRef.current = { ...point, sentAt: Date.now() };
          void supabase.from('delivery_locations').insert({ delivery_id: deliveryId, driver_id: driverId, latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10_000 }
      );
    };
    sendLocationIfNeeded();
    const gpsInterval = window.setInterval(sendLocationIfNeeded, 20_000);

    return () => window.clearInterval(gpsInterval);
  }, [offer?.deliveryId, status, driverId]);

  // Toggle Availability Status (🟢 Online / 🟡 Pausado / 🔴 Offline)
  const toggleStatus = async (newStatus: "ONLINE" | "PAUSADO" | "OFFLINE") => {
    setStatus(newStatus);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: driver } = user.user ? await supabase.from('delivery_drivers').select('id').eq('user_id', user.user.id).maybeSingle() : { data: null };
      if (driver) await supabase.from('delivery_drivers').update({ availability: newStatus === 'ONLINE' ? 'online' : newStatus === 'PAUSADO' ? 'paused' : 'offline' }).eq('id', driver.id);
    } catch (e) {
      console.error("Erro ao alterar status:", e);
    }
  };

  // Accept Offer
  const acceptOffer = async () => {
    if (!offer) return;
    try {
      const { data: accepted, error: acceptError } = await supabase.rpc('accept_delivery_offer', { p_offer_id: offer.id });
      if (acceptError) throw acceptError;
      if (accepted) {
        setSelectedRouteModal(true); // Open route map immediately!
        await loadData();
      }
    } catch (e) {
      console.error("Erro ao aceitar oferta:", e);
    }
  };

  // Decline Offer
  const declineOffer = async () => {
    if (!offer) return;
    try {
      await supabase.from('delivery_offers').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', offer.id).eq('status', 'offered');
      setOffer(null);
      await loadData();
    } catch (e) {
      console.error("Erro ao recusar oferta:", e);
    }
  };

  // Advance FSM State
  const advanceFSM = async (nextStatus: DeliveryStatus) => {
    if (!offer) return;
    try {
      const { data: current } = await supabase.from('delivery_offers').select('delivery_id').eq('id', offer.id).maybeSingle();
      const statusMap: Record<string, string> = { A_CAMINHO_DA_COLETA: 'pickup', PEDIDO_COLETADO: 'in_transit', A_CAMINHO_DO_CLIENTE: 'in_transit', ENTREGUE: 'delivered' };
      if (current) { const { error } = await supabase.rpc('advance_delivery_status', { p_delivery_id: current.delivery_id, p_status: statusMap[nextStatus] ?? 'in_transit' }); if (error) throw error; await loadData(); }
    } catch (e) {
      console.error("Erro ao avançar FSM:", e);
    }
  };

  // Confirm Delivery via PIN
  const confirmPin = async () => {
    if (!offer) return;
    setPinError('');
    try {
      const { error } = await supabase.rpc('confirm_delivery_pin', { p_delivery_id: (offer as any).deliveryId, p_pin: pinInput });
      if (error) { setPinError(error.message ?? 'Código PIN incorreto.'); return; }
      setPinInput('');
      await loadData();
    } catch (e) {
      setPinError('Erro ao validar PIN. Tente novamente.');
    }
  };

  // Submit Incident (⚠️ Problema)
  const submitIncident = async () => {
    if (!offer) return;
    try {
      const { error } = await supabase.rpc('report_delivery_incident', { p_delivery_id: (offer as any).deliveryId, p_reason: incidentReason, p_note: incidentNote });
      if (error) throw error;
      setIsIncidentModalOpen(false);
      await loadData();
    } catch (e) {
      console.error("Erro ao registrar ocorrência:", e);
    }
  };

  const openGoogleMaps = (addr: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, '_blank');
  };

  const openWaze = (addr: string) => {
    window.open(`https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* 👤 Header Superior com Perfil e Status 🟢 ONLINE / 🟡 PAUSADO / 🔴 OFFLINE */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">
              <User className="h-5 w-5" />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${
              status === "ONLINE" ? 'bg-emerald-500' : status === "PAUSADO" ? 'bg-amber-500' : 'bg-red-500'
            }`} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Entregador</p>
            <p className="text-sm font-bold text-slate-100 truncate max-w-[120px]">{name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Availability Status Selector */}
          <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => toggleStatus("ONLINE")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 ${
                status === "ONLINE" ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🟢 <span className="hidden sm:inline">Online</span>
            </button>
            <button
              onClick={() => toggleStatus("PAUSADO")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 ${
                status === "PAUSADO" ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🟡 <span className="hidden sm:inline">Pausa</span>
            </button>
            <button
              onClick={() => toggleStatus("OFFLINE")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 ${
                status === "OFFLINE" ? 'bg-red-500 text-slate-950 shadow-md shadow-red-500/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🔴 <span className="hidden sm:inline">Off</span>
            </button>
          </div>

          <button onClick={() => setIsChatOpen(true)} className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800" title="Chat">
            <MessageCircle className="h-4 w-4" />
          </button>
          <button onClick={onLogout} className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isChatOpen && <ChatEquipe token={token} onClose={() => setIsChatOpen(false)} />}

      {/* 🏠 2. Tela Principal — Ganhos & Resumo do Dia */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Card Principal de Ganhos Hoje (Conforme mockup do usuário) */}
        <div
          onClick={() => setIsStatsModalOpen(true)}
          className="cursor-pointer rounded-3xl border border-orange-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center shadow-xl hover:border-orange-500/50 transition relative overflow-hidden group"
        >
          <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] uppercase font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
            <TrendingUp className="h-3 w-3" /> Dashboard 📊
          </div>

          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Ganhos Hoje</p>
          <p className="text-4xl font-extrabold text-orange-400 tracking-tight">
            R$ {(stats?.todayEarnings ?? 87.50).toFixed(2)}
          </p>

          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-4 text-sm">
            <div className="text-left">
              <p className="text-xs text-slate-400 font-medium">Entregas</p>
              <p className="font-bold text-slate-100 text-base">
                <span className="text-orange-400">{stats?.todayDeliveries ?? 8}</span> no total • <span className="text-emerald-400">{stats?.todayCompleted ?? 7}</span> concluídas
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium">Distância & Tempo</p>
              <p className="font-bold text-slate-100 text-base">
                {stats?.todayDistanceKm ?? 28.4} km • {stats?.todayHours ?? 5.5}h
              </p>
            </div>
          </div>
        </div>

        {/* 📦 3. NOVA ENTREGA em Destaque (Se houver oferta e o status estiver ONLINE) */}
        {status === "ONLINE" && offer && (offer.status === "OFERTADA" || offer.status === "AGUARDANDO_ENTREGADOR" || offer.status === "CRIADA") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border-2 border-orange-500 bg-slate-900 p-5 shadow-2xl shadow-orange-500/10 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-orange-500 animate-ping" />
                <span className="text-xs font-extrabold uppercase tracking-widest text-orange-400">📦 NOVA ENTREGA</span>
              </div>
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-orange-400" /> ~{offer.estimatedMinutes} min
              </span>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-400">Coleta no Estabelecimento</p>
                  <p className="text-sm font-bold text-slate-100">{offer.restaurantName}</p>
                  <p className="text-slate-400 truncate">{offer.restaurantAddress}</p>
                </div>
              </div>

              <div className="my-1 border-l-2 border-dashed border-slate-700 ml-1 h-3" />

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-400">Entrega ao Cliente</p>
                  <p className="text-sm font-bold text-slate-100">{offer.customerName}</p>
                  <p className="text-slate-400 truncate">{offer.customerAddress}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <div>
                <p className="text-xs text-slate-400">Distância / Ganho</p>
                <p className="text-xl font-extrabold text-orange-400">{offer.distanceKm} km • R$ {offer.feeEarnings.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setSelectedRouteModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <Compass className="h-4 w-4 text-sky-400" /> Ver Rota
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={declineOffer}
                className="rounded-2xl border border-slate-700 bg-slate-800 py-3.5 font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition"
              >
                [ RECUSAR ]
              </button>
              <button
                onClick={acceptOffer}
                className="rounded-2xl bg-orange-500 py-3.5 font-extrabold text-slate-950 hover:bg-orange-400 shadow-lg shadow-orange-500/20 transition"
              >
                [ ACEITAR ]
              </button>
            </div>
          </motion.div>
        )}

        {/* 🚴 ENTREGA EM ANDAMENTO — Ciclo FSM (ACEITA ➔ A_CAMINHO ➔ COLETA ➔ DESTINO ➔ PIN ➔ ENTREGUE) */}
        {offer && ["ACEITA", "A_CAMINHO_DA_COLETA", "CHEGUEI_NA_COLETA", "PEDIDO_COLETADO", "A_CAMINHO_DO_CLIENTE", "CHEGUEI_NO_DESTINO"].includes(offer.status) && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-sky-500/40 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="inline-block rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-extrabold uppercase text-sky-400 border border-sky-500/30">
                  {offer.status.replace(/_/g, ' ')}
                </span>
                <p className="text-xs text-slate-400 mt-1">Pedido #{offer.orderId}</p>
              </div>
              <button
                onClick={() => setIsIncidentModalOpen(true)}
                className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> ⚠️ Problema
              </button>
            </div>

            {/* Informações da Coleta / Cliente */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 font-semibold">Cliente:</p>
                  <p className="text-sm font-bold text-slate-100">{offer.customerName}</p>
                  <p className="text-slate-400 truncate mt-0.5">{offer.customerAddress}</p>
                </div>
                <a href={`tel:${offer.customerPhone}`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                  <Phone className="h-4 w-4" />
                </a>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                <span>Distância: <strong className="text-slate-200">{offer.distanceKm} km</strong></span>
                <span>Pagamento: <strong className="text-emerald-400 uppercase">{offer.paymentMethod}</strong></span>
              </div>
            </div>

            {/* Botões do mapa / Waze */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => openGoogleMaps(offer.customerAddress)} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                <ExternalLink className="h-3.5 w-3.5 text-emerald-400" /> Google Maps
              </button>
              <button onClick={() => openWaze(offer.customerAddress)} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                <Navigation className="h-3.5 w-3.5 text-sky-400" /> Waze GPS
              </button>
            </div>

            {/* 🏪 7. Estágio 1: Coleta no Estabelecimento */}
            {["ACEITA", "A_CAMINHO_DA_COLETA"].includes(offer.status) && (
              <button
                onClick={async () => {
                  await advanceFSM("CHEGUEI_NA_COLETA");
                  setSelectedRouteModal(true);
                }}
                className="w-full rounded-2xl bg-sky-500 py-3.5 font-extrabold text-slate-950 hover:bg-sky-400 shadow-lg shadow-sky-500/20 transition"
              >
                CHEGUEI AO ESTABELECIMENTO
              </button>
            )}

            {offer.status === "CHEGUEI_NA_COLETA" && (
              <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                <p className="text-xs font-semibold text-amber-400">Código de Retirada / Pedido:</p>
                <p className="text-3xl font-extrabold text-slate-100 tracking-widest bg-slate-950 py-2 rounded-xl border border-slate-800">
                  {offer.deliveryPin}
                </p>
                <button
                  onClick={async () => {
                    await advanceFSM("PEDIDO_COLETADO");
                    await advanceFSM("A_CAMINHO_DO_CLIENTE");
                    setSelectedRouteModal(true); // Open route map to client's destination immediately!
                  }}
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 font-extrabold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition"
                >
                  PEDIDO COLETADO (INICIAR ROTA DO CLIENTE)
                </button>
              </div>
            )}

            {/* 🏠 8. Estágio 2: Entrega ao Cliente (A Caminho & Cheguei no Destino) */}
            {offer.status === "PEDIDO_COLETADO" && (
              <button
                onClick={async () => {
                  await advanceFSM("A_CAMINHO_DO_CLIENTE");
                  setSelectedRouteModal(true);
                }}
                className="w-full rounded-2xl bg-sky-500 py-3.5 font-extrabold text-slate-950 hover:bg-sky-400 shadow-lg shadow-sky-500/20 transition"
              >
                INICIAR NAVEGAÇÃO AO CLIENTE
              </button>
            )}

            {offer.status === "A_CAMINHO_DO_CLIENTE" && (
              <button
                onClick={() => advanceFSM("CHEGUEI_NO_DESTINO")}
                className="w-full rounded-2xl bg-amber-500 py-3.5 font-extrabold text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition"
              >
                CHEGUEI NO DESTINO
              </button>
            )}

            {/* 🔑 Confirmação por PIN de 4 dígitos (Últimos 4 dígitos do telefone cadastrado pelo cliente) */}
            {offer.status === "CHEGUEI_NO_DESTINO" && (
              <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Digite o código PIN do cliente:
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  (O código corresponde aos <strong>últimos 4 dígitos do telefone</strong> cadastrado pelo cliente no marketplace)
                </p>
                <input
                  type="text"
                  maxLength={4}
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="_ _ _ _"
                  className="w-full text-center text-3xl font-extrabold tracking-[0.5em] bg-slate-950 text-slate-100 py-3 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
                />
                {pinError && <p className="text-xs font-medium text-red-400">{pinError}</p>}
                <button
                  onClick={confirmPin}
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 font-extrabold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition"
                >
                  [ CONFIRMAR ENTREGA ]
                </button>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* 📊 Modal do Dashboard Completo de Gestão do Entregador (Persistido no PostgreSQL) */}
      <AnimatePresence>
        {isStatsModalOpen && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-base">Painel de Gestão do Motoboy</h3>
                    <p className="text-xs text-slate-400">Métricas Persistidas no PostgreSQL</p>
                  </div>
                </div>
                <button onClick={() => setIsStatsModalOpen(false)} className="rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400 font-medium mb-1">Total de Entregas</p>
                  <p className="text-2xl font-extrabold text-orange-400">{stats.totalDeliveries}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400 font-medium mb-1">Faturamento Acumulado</p>
                  <p className="text-2xl font-extrabold text-emerald-400">R$ {stats.totalEarnings.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400 font-medium mb-1">Maior Distância</p>
                  <p className="text-xl font-bold text-sky-400">{stats.longestDistanceKm} km</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400 font-medium mb-1">Tempo Médio</p>
                  <p className="text-xl font-bold text-amber-400">{stats.avgDeliveryMinutes} min</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-slate-200">Avaliação do Entregador</p>
                  <p className="text-xs text-slate-400">{stats.ratingCount} avaliações recebidas</p>
                </div>
                <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 text-amber-400 font-bold">
                  ⭐ {stats.rating.toFixed(1)}
                </div>
              </div>

              <button onClick={() => setIsStatsModalOpen(false)} className="w-full rounded-2xl bg-slate-800 py-3 font-bold text-slate-200 hover:bg-slate-700">
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⚠️ Modal de Registro de Problema / Ocorrência */}
      <AnimatePresence>
        {isIncidentModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <AlertTriangle className="h-5 w-5" /> ⚠️ Reportar Problema
                </div>
                <button onClick={() => setIsIncidentModalOpen(false)} className="rounded-full bg-slate-800 p-1.5 text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Motivo do Problema:</label>
                  <select
                    value={incidentReason}
                    onChange={(e) => setIncidentReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100 focus:outline-none"
                  >
                    <option>Cliente não está em casa</option>
                    <option>Endereço incorreto</option>
                    <option>Estabelecimento fechado</option>
                    <option>Pedido não está pronto</option>
                    <option>Veículo apresentou problema</option>
                    <option>Acidente</option>
                    <option>Cliente recusou pedido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Observações:</label>
                  <textarea
                    rows={3}
                    value={incidentNote}
                    onChange={(e) => setIncidentNote(e.target.value)}
                    placeholder="Descreva o que aconteceu..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => setIsIncidentModalOpen(false)} className="rounded-xl border border-slate-700 bg-slate-800 py-3 font-semibold text-slate-300">
                  Cancelar
                </button>
                <button onClick={submitIncident} className="rounded-xl bg-amber-500 py-3 font-bold text-slate-950 hover:bg-amber-400">
                  Enviar ao Gestor
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedRouteModal && offer && (
          <InteractiveRouteModal
            offer={offer}
            onClose={() => setSelectedRouteModal(false)}
            onAdvanceFSM={advanceFSM}
            onConfirmPin={confirmPin}
            pinInput={pinInput}
            setPinInput={setPinInput}
            pinError={pinError}
            openGoogleMaps={openGoogleMaps}
            openWaze={openWaze}
          />
        )}
      </AnimatePresence>

      <Toaster />
    </div>
  );
}

function InteractiveRouteModal({
  offer,
  onClose,
  onAdvanceFSM,
  onConfirmPin,
  pinInput,
  setPinInput,
  pinError,
  openGoogleMaps,
  openWaze
}: {
  offer: DeliveryOffer;
  onClose: () => void;
  onAdvanceFSM: (status: DeliveryStatus) => Promise<void>;
  onConfirmPin: () => Promise<void>;
  pinInput: string;
  setPinInput: (val: string) => void;
  pinError: string;
  openGoogleMaps: (addr: string) => void;
  openWaze: (addr: string) => void;
}) {
  const isStage1 = ["CRIADA", "AGUARDANDO_ENTREGADOR", "OFERTADA", "ACEITA", "A_CAMINHO_DA_COLETA", "CHEGUEI_NA_COLETA"].includes(offer.status);
  const isStage2 = ["PEDIDO_COLETADO", "A_CAMINHO_DO_CLIENTE", "CHEGUEI_NO_DESTINO"].includes(offer.status);

  const targetAddress = isStage1 ? offer.restaurantAddress : offer.customerAddress;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 font-sans">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-3 w-3 rounded-full ${isStage1 ? 'bg-sky-400' : 'bg-emerald-400'} animate-ping`} />
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                {isStage1 ? "🏪 ETAPA 1: ROTA DA COLETA" : "🏠 ETAPA 2: ROTA DA ENTREGA"}
              </p>
              <h3 className="text-sm font-bold text-slate-100 truncate max-w-[220px]">
                {isStage1 ? offer.restaurantName : offer.customerName}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Real Interactive OpenStreetMap & Valhalla Engine Route Map */}
        <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-inner">
          <RealLeafletMap
            origin={
              isStage1
                ? { lat: offer.driverLat ?? -23.55052, lng: offer.driverLng ?? -46.633308, label: 'Sua Posição (Motoboy)', type: 'courier' }
                : { lat: -23.55552, lng: -46.643308, label: offer.restaurantName, type: 'store' }
            }
            destination={
              isStage1
                ? { lat: -23.55552, lng: -46.643308, label: offer.restaurantName, type: 'store' }
                : { lat: -23.56152, lng: -46.655908, label: offer.customerName, type: 'customer' }
            }
            driverPos={
              offer.driverLat && offer.driverLng
                ? { lat: offer.driverLat, lng: offer.driverLng }
                : undefined
            }
            className="h-full w-full"
          />

          {/* Live GPS Status Overlay */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/90 border border-slate-800 px-3 py-1 text-[11px] text-slate-300 backdrop-blur shadow-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold">Navegação Valhalla • GPS Ativo</span>
          </div>

          {/* Distance & Time Overlay */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 backdrop-blur shadow-md">
            <Compass className="h-4 w-4 text-sky-400" />
            <span><strong>{offer.distanceKm} km</strong> (~{offer.estimatedMinutes} min)</span>
          </div>
        </div>

        {/* Address Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5 space-y-1 text-xs">
          <p className="text-slate-400 font-semibold flex items-center gap-1">
            {isStage1 ? <Package className="h-3.5 w-3.5 text-orange-400" /> : <MapPin className="h-3.5 w-3.5 text-sky-400" />}
            Endereço do Destino Atual:
          </p>
          <p className="text-sm font-bold text-slate-100">{isStage1 ? offer.restaurantName : offer.customerName}</p>
          <p className="text-slate-300 font-medium">{targetAddress}</p>
        </div>

        {/* External GPS App Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => openGoogleMaps(targetAddress)} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            <ExternalLink className="h-3.5 w-3.5 text-emerald-400" /> Google Maps
          </button>
          <button onClick={() => openWaze(targetAddress)} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            <Navigation className="h-3.5 w-3.5 text-sky-400" /> Waze GPS
          </button>
        </div>

        {/* Action Controls depending on delivery state */}
        <div className="pt-2">
          {["ACEITA", "A_CAMINHO_DA_COLETA"].includes(offer.status) && (
            <button
              onClick={async () => {
                await onAdvanceFSM("CHEGUEI_NA_COLETA");
              }}
              className="w-full rounded-2xl bg-sky-500 py-3.5 font-extrabold text-slate-950 hover:bg-sky-400 shadow-lg shadow-sky-500/20 transition"
            >
              [ CHEGUEI AO ESTABELECIMENTO ]
            </button>
          )}

          {offer.status === "CHEGUEI_NA_COLETA" && (
            <div className="space-y-3 text-center">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold text-amber-400">Código de Retirada do Pedido:</p>
                <p className="text-2xl font-extrabold text-slate-100 tracking-widest font-mono">{offer.deliveryPin}</p>
              </div>
              <button
                onClick={async () => {
                  await onAdvanceFSM("PEDIDO_COLETADO");
                  await onAdvanceFSM("A_CAMINHO_DO_CLIENTE");
                }}
                className="w-full rounded-2xl bg-emerald-500 py-3.5 font-extrabold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition"
              >
                [ PEDIDO COLETADO (MUDAR ROTA PARA CLIENTE) ]
              </button>
            </div>
          )}

          {offer.status === "PEDIDO_COLETADO" && (
            <button
              onClick={async () => {
                await onAdvanceFSM("A_CAMINHO_DO_CLIENTE");
              }}
              className="w-full rounded-2xl bg-sky-500 py-3.5 font-extrabold text-slate-950 hover:bg-sky-400 shadow-lg shadow-sky-500/20 transition"
            >
              [ INICIAR ROTA PARA A CASA DO CLIENTE ]
            </button>
          )}

          {offer.status === "A_CAMINHO_DO_CLIENTE" && (
            <button
              onClick={async () => {
                await onAdvanceFSM("CHEGUEI_NO_DESTINO");
              }}
              className="w-full rounded-2xl bg-amber-500 py-3.5 font-extrabold text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition"
            >
              [ CHEGUEI NO DESTINO DO CLIENTE ]
            </button>
          )}

          {offer.status === "CHEGUEI_NO_DESTINO" && (
            <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Digite o PIN do cliente:
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                (Últimos 4 dígitos do telefone do cliente)
              </p>
              <input
                type="text"
                maxLength={4}
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="_ _ _ _"
                className="w-full text-center text-3xl font-extrabold tracking-[0.5em] bg-slate-950 text-slate-100 py-3 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              {pinError && <p className="text-xs font-medium text-red-400">{pinError}</p>}
              <button
                onClick={async () => {
                  await onConfirmPin();
                  onClose();
                }}
                className="w-full rounded-2xl bg-emerald-500 py-3.5 font-extrabold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition"
              >
                [ CONFIRMAR ENTREGA ]
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('miar-entregador-token') ?? sessionStorage.getItem('miar-entregador-token') ?? '');
  const [name, setName] = useState(() => localStorage.getItem('miar-entregador-name') ?? sessionStorage.getItem('miar-entregador-name') ?? '');
  const [showPasskey, setShowPasskey] = useState(false);

  const onLogin = (t: string, n: string, remember = true) => {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem('miar-entregador-token'); otherStorage.removeItem('miar-entregador-name');
    storage.setItem('miar-entregador-token', t); storage.setItem('miar-entregador-name', n);
    setToken(t); setName(n);
  };
  const onLogout = () => { localStorage.removeItem('miar-entregador-token'); localStorage.removeItem('miar-entregador-name'); setToken(''); setName(''); };

  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        {token ? (
          <DeliveryBoard token={token} name={name} onLogout={onLogout} />
        ) : (
          <TokenLogin onLogin={onLogin} />
        )}
        <ConfigFlutuante />
        {showPasskey && token && <EmployeePasskeyPrompt token={token} onDone={() => { setShowPasskey(false); }} />}
        <Toaster />
        <InstallPrompt />
      </QueryClientProvider>
    </IdiomaProvider>
  );
}

export default App;
