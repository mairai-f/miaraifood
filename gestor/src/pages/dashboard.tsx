import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import {
  UtensilsCrossed,
  CreditCard,
  ChefHat,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Bot,
  Settings,
  BookOpen,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Play,
  X,
  Tv,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/IdiomaContext';

const PAYMENT_METHOD_LABELS: Record<string, { label: string; emoji: string }> = {
  pix: { label: 'Pix', emoji: '⚡' },
  credit: { label: 'Crédito', emoji: '💳' },
  debit: { label: 'Débito', emoji: '💳' },
  cash: { label: 'Dinheiro', emoji: '💵' },
};

type FaturamentoHoje = {
  totalCents: number;
  count: number;
  byMethod: Record<string, { cents: number; count: number }>;
};

const FATURAMENTO_VAZIO: FaturamentoHoje = { totalCents: 0, count: 0, byMethod: {} };

function getOwnerToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
}

export default function UnifiedDashboard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const [activeTables, setActiveTables] = useState<any[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [deliveryOffers, setDeliveryOffers] = useState<any[]>([]);
  const [faturamentoHoje, setFaturamentoHoje] = useState<FaturamentoHoje>(FATURAMENTO_VAZIO);

  const loadDashboardRealtime = async () => {
    const token = getOwnerToken();
    if (!token) return;

    // 1. Live tables & active value directly from database
    try {
      const r = await fetch('/api/tables', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const tablesData = await r.json();
        if (Array.isArray(tablesData)) {
          const occupied = tablesData.filter((t: any) => t.status !== 'free' && t.orders?.length > 0);
          setActiveTables(
            occupied.map((t: any) => ({
              id: t.id,
              name: `Mesa ${t.number}`,
              waiters: 'Garçom',
              itemsCount: (t.orders || []).reduce((acc: number, o: any) => acc + (o.qty || 1), 0),
              total: t.total || 0,
              durationMinutes: 10,
              status: t.status === 'preparing' ? 'Em preparo' : t.status === 'ready' ? 'Pronta' : 'Ocupada',
            }))
          );
        }
      }
    } catch {}

    // 2. Realtime kitchen orders from DB
    try {
      const r = await fetch('/api/kitchen/orders', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const kitchenData = await r.json();
        if (Array.isArray(kitchenData)) {
          const pending = kitchenData.filter((t: any) => t.status !== 'completed');
          setKitchenOrders(pending);
        }
      }
    } catch {}

    // 3. Faturamento Hoje diretamente das movimentações financeiras no DB
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);
    const fimDoDia = new Date();
    fimDoDia.setHours(23, 59, 59, 999);

    try {
      const r = await fetch(`/api/financial-movements?from=${inicioDoDia.toISOString()}&to=${fimDoDia.toISOString()}&direction=inflow`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        if (data?.movements) {
          const byMethod: Record<string, { cents: number; count: number }> = {};
          let totalCents = 0;
          for (const mov of data.movements as Array<{ amountCents: number; paymentMethod: string }>) {
            totalCents += mov.amountCents;
            const entry = byMethod[mov.paymentMethod] ?? { cents: 0, count: 0 };
            entry.cents += mov.amountCents;
            entry.count += 1;
            byMethod[mov.paymentMethod] = entry;
          }
          setFaturamentoHoje({ totalCents, count: data.movements.length, byMethod });
        }
      }
    } catch {}

    // 4. Deliveries ativos
    try {
      const r = await fetch('/api/delivery-dispatch/board', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        if (data?.data) {
          setDeliveryOffers(data.data);
        }
      }
    } catch {}
  };

  useEffect(() => {
    void loadDashboardRealtime();
    const interval = setInterval(loadDashboardRealtime, 2000);

    const source = new EventSource('/api/events');
    const refetch = () => void loadDashboardRealtime();
    source.addEventListener('order:new', refetch);
    source.addEventListener('order:ready', refetch);
    source.addEventListener('order:completed', refetch);
    source.addEventListener('order:cancelled', refetch);

    return () => {
      clearInterval(interval);
      source.close();
    };
  }, []);

  const todayRevenueTotal = faturamentoHoje.totalCents / 100;
  const todayCompletedCount = faturamentoHoje.count;
  const ticketMedio = faturamentoHoje.count > 0 ? faturamentoHoje.totalCents / 100 / faturamentoHoje.count : 0;

  const totalActiveValue = useMemo(() => {
    return activeTables.reduce((acc, t) => acc + t.total, 0);
  }, [activeTables]);

  // Modal de Resumo KPI Clicável State
  const [selectedKpiModal, setSelectedKpiModal] = useState<'mesas' | 'faturamento' | 'kds' | 'ia' | 'delivery' | null>(null);

  // Lock body scroll when modal open
  useEffect(() => {
    if (selectedKpiModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedKpiModal]);

  return (
    <div className="space-y-6 text-[#ffffff]">
      {/* Top Banner Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-[#0B1A10] bg-[#0B1A10] p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#008000]">
              {t('dashboard.titulo')}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              ● {t('nav.painel')}
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#ffffff] mt-1">
            {t('dashboard.titulo')}
          </h1>
          <p className="text-xs text-[#e5e5e5] mt-1 max-w-xl">
            Acompanhe a movimentação de mesas, faturamento acumulado, pedidos na cozinha e produtividade da equipe em uma única tela.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <Link
            href="/app/pdv"
            className="flex items-center gap-2 rounded-xl bg-[#008000] px-4 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#008000]/90 transition-all shadow-[0_4px_14px_rgba(252,163,17,0.3)]"
          >
            <CreditCard className="h-4 w-4" />
            Abrir PDV Caixa
          </Link>
          <Link
            href="/app/cozinha"
            className="flex items-center gap-2 rounded-xl border border-[#008000]/40 bg-[#000000] px-4 py-2.5 text-xs font-bold text-[#008000] hover:bg-[#0B1A10] transition-all"
          >
            <ChefHat className="h-4 w-4" />
            KDS Cozinha
          </Link>
          <Link
            href="/central-comando"
            className="flex items-center gap-2 rounded-xl border border-[#16301F] bg-[#0B1A10] px-4 py-2.5 text-xs font-bold text-[#38B000] hover:bg-[#16301F] transition-all"
          >
            <Tv className="h-4 w-4" />
            Central Multi-Monitor / TV
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards — Clicáveis com Resumo Detalhado (Abrem Modal) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Mesas Abertas */}
        <div
          onClick={() => setSelectedKpiModal('mesas')}
          className="rounded-2xl border border-[#0B1A10] bg-[#0B1A10]/90 p-5 space-y-2 relative overflow-hidden cursor-pointer hover:border-[#008000] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg group"
        >
          <div className="flex items-center justify-between text-[#e5e5e5]">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#008000] transition-colors flex items-center gap-1.5">
              Mesas & Comandas
            </span>
            <div className="p-2 rounded-xl bg-[#008000]/10 text-[#008000] group-hover:bg-[#008000] group-hover:text-black transition-colors">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#ffffff]">{activeTables.length} Abertas</div>
          <div className="text-xs text-[#008000] font-bold flex items-center justify-between pt-1">
            <span>Total em consumo: R$ {totalActiveValue.toFixed(2)}</span>
            <span className="text-[10px] bg-[#008000]/20 text-[#008000] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 group-hover:bg-[#008000] group-hover:text-black transition-all">
              Ver Resumo <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Faturamento do Dia */}
        <div
          onClick={() => setSelectedKpiModal('faturamento')}
          className="rounded-2xl border border-[#0B1A10] bg-[#0B1A10]/90 p-5 space-y-2 relative overflow-hidden cursor-pointer hover:border-[#008000] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg group"
        >
          <div className="flex items-center justify-between text-[#e5e5e5]">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#008000] transition-colors">
              Faturamento Hoje
            </span>
            <div className="p-2 rounded-xl bg-[#008000]/10 text-[#008000] group-hover:bg-[#008000] group-hover:text-black transition-colors">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#ffffff]">R$ {todayRevenueTotal.toFixed(2)}</div>
          <div className="text-xs text-emerald-400 font-bold flex items-center justify-between pt-1">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" /> {todayCompletedCount} Pedidos encerrados
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 group-hover:bg-emerald-400 group-hover:text-black transition-all">
              Ver DRE <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Fila da Cozinha */}
        <div
          onClick={() => setSelectedKpiModal('kds')}
          className="rounded-2xl border border-[#0B1A10] bg-[#0B1A10]/90 p-5 space-y-2 relative overflow-hidden cursor-pointer hover:border-[#008000] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg group"
        >
          <div className="flex items-center justify-between text-[#e5e5e5]">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#008000] transition-colors">
              Fila de Espera KDS
            </span>
            <div className="p-2 rounded-xl bg-[#008000]/10 text-[#008000] group-hover:bg-[#008000] group-hover:text-black transition-colors">
              <ChefHat className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#ffffff]">{kitchenOrders.length} Pedidos</div>
          <div className="text-xs text-[#e5e5e5] font-bold flex items-center justify-between pt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#008000]" /> Tempo médio: 14 min
            </span>
            <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 group-hover:bg-orange-400 group-hover:text-black transition-all">
              Ver Fila <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Card 3.5: Delivery */}
        <div
          onClick={() => setSelectedKpiModal('delivery')}
          className="rounded-2xl border border-[#0B1A10] bg-[#0B1A10]/90 p-5 space-y-2 relative overflow-hidden cursor-pointer hover:border-[#008000] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg group"
        >
          <div className="flex items-center justify-between text-[#e5e5e5]">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#008000] transition-colors">
              Malha Logística
            </span>
            <div className="p-2 rounded-xl bg-[#008000]/10 text-[#008000] group-hover:bg-[#008000] group-hover:text-black transition-colors">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#ffffff]">{deliveryOffers.length} Ativas</div>
          <div className="text-xs text-blue-400 font-bold flex items-center justify-between pt-1">
            <span className="flex items-center gap-1">
              {deliveryOffers.filter(o => o.status === 'PENDING').length} buscando motoboy
            </span>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 group-hover:bg-blue-400 group-hover:text-black transition-all">
              Ver Malha <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Card 4: IA Ária Status */}
        <div
          onClick={() => setSelectedKpiModal('ia')}
          className="rounded-2xl border border-[#0B1A10] bg-[#0B1A10]/90 p-5 space-y-2 relative overflow-hidden cursor-pointer hover:border-[#008000] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg group"
        >
          <div className="flex items-center justify-between text-[#e5e5e5]">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#008000] transition-colors">
              IA Ária Copilot
            </span>
            <div className="p-2 rounded-xl bg-[#008000]/10 text-[#008000] group-hover:bg-[#008000] group-hover:text-black transition-colors">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#ffffff]">100% Ativa</div>
          <div className="text-xs text-[#008000] font-bold flex items-center justify-between pt-1">
            <span>Rentabilidade & Estoque</span>
            <span className="text-[10px] bg-[#008000]/20 text-[#008000] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 group-hover:bg-[#008000] group-hover:text-black transition-all">
              Ver Dicas <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Tables & Comandas List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tables Detailed View */}
        <div className="lg:col-span-2 rounded-2xl border border-[#0B1A10] bg-[#0B1A10]/90 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#000000]/40 pb-3">
            <div>
              <h2 className="text-base font-bold text-[#ffffff]">Mesas & Comandas em Atendimento</h2>
              <p className="text-xs text-[#e5e5e5]">Clique para visualizar ou fechar a conta diretamente no PDV.</p>
            </div>
            <Link
              href="/app/mesas"
              className="text-xs font-bold text-[#008000] hover:underline"
            >
              Ver mapa completo →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeTables.map((table) => (
              <div
                key={table.id}
                className="p-4 rounded-xl border border-[#000000] bg-[#000000] space-y-2 hover:border-[#008000]/50 transition-all cursor-pointer"
                onClick={() => {
                  toast.info(`Abrindo detalhes de ${table.name}`);
                  setLocation('/app/pdv');
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#ffffff]">{table.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#008000]/40 bg-[#008000]/10 text-[#008000]">
                    {table.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#e5e5e5]">
                  <span>Atendente: {table.waiters}</span>
                  <span>{table.itemsCount} itens</span>
                </div>
                <div className="pt-2 border-t border-[#0B1A10] flex items-center justify-between font-bold text-xs">
                  <span className="text-[#e5e5e5] flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#008000]" /> {table.durationMinutes} min
                  </span>
                  <span className="text-[#008000] text-sm">R$ {table.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Shortcuts & System Health */}
        <div className="rounded-2xl border border-[#0B1A10] bg-[#0B1A10]/90 p-5 space-y-4">
          <h2 className="text-base font-bold text-[#ffffff] border-b border-[#000000]/40 pb-3">
            Atalhos Rápidos
          </h2>

          <div className="space-y-2">
            <Link
              href="/app/pdv"
              className="flex items-center justify-between p-3 rounded-xl border border-[#000000] bg-[#000000] hover:border-[#008000] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#008000]/10 text-[#008000]">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#ffffff] group-hover:text-[#008000]">Frente de Caixa (PDV)</div>
                  <div className="text-[10px] text-[#e5e5e5]">Lançamento rápido e pagamento</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[#e5e5e5] group-hover:text-[#008000]" />
            </Link>

            <Link
              href="/app/cozinha"
              className="flex items-center justify-between p-3 rounded-xl border border-[#000000] bg-[#000000] hover:border-[#008000] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#008000]/10 text-[#008000]">
                  <ChefHat className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#ffffff] group-hover:text-[#008000]">Monitor da Cozinha</div>
                  <div className="text-[10px] text-[#e5e5e5]">KDS em tempo real para os chefs</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[#e5e5e5] group-hover:text-[#008000]" />
            </Link>

            <Link
              href="/catalogo"
              className="flex items-center justify-between p-3 rounded-xl border border-[#000000] bg-[#000000] hover:border-[#008000] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#008000]/10 text-[#008000]">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#ffffff] group-hover:text-[#008000]">Cardápio Digital & IA</div>
                  <div className="text-[10px] text-[#e5e5e5]">Produtos pré-cadastrados por segmento</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[#e5e5e5] group-hover:text-[#008000]" />
            </Link>

            <Link
              href="/configuracoes"
              className="flex items-center justify-between p-3 rounded-xl border border-[#000000] bg-[#000000] hover:border-[#008000] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#008000]/10 text-[#008000]">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#ffffff] group-hover:text-[#008000]">Configurações & Equipe</div>
                  <div className="text-[10px] text-[#e5e5e5]">Permissões, Impressoras e Loja</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[#e5e5e5] group-hover:text-[#008000]" />
            </Link>
          </div>
        </div>
      </div>

      {/* MODAL INTERATIVO DE RESUMO KPI */}
      {selectedKpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl space-y-4 font-inter text-[#F2F7F3]">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3">
              <div className="flex items-center gap-2">
                {selectedKpiModal === 'mesas' && <UtensilsCrossed className="h-5 w-5 text-[#008000]" />}
                {selectedKpiModal === 'faturamento' && <TrendingUp className="h-5 w-5 text-emerald-400" />}
                {selectedKpiModal === 'kds' && <ChefHat className="h-5 w-5 text-orange-400" />}
                {selectedKpiModal === 'delivery' && <Package className="h-5 w-5 text-blue-400" />}
                {selectedKpiModal === 'ia' && <Bot className="h-5 w-5 text-[#38B000]" />}
                <h3 className="font-manrope font-bold text-base text-[#F2F7F3]">
                  {selectedKpiModal === 'mesas' && 'Resumo Operacional — Mesas & Comandas'}
                  {selectedKpiModal === 'faturamento' && 'Resumo Financeiro — Faturamento Hoje'}
                  {selectedKpiModal === 'kds' && 'Resumo da Cozinha — Fila KDS'}
                  {selectedKpiModal === 'delivery' && 'Resumo Logístico — Delivery MIAR'}
                  {selectedKpiModal === 'ia' && 'Resumo de Inteligência — IA Ária Copilot'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKpiModal(null)}
                className="rounded-lg p-1.5 text-[#8FA396] hover:text-white hover:bg-[#06100A]/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo Específico do Modal */}
            {selectedKpiModal === 'mesas' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#06100A] rounded-xl border border-[#16301F] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#8FA396]">Mesas em Atendimento:</span>
                    <strong className="block text-sm text-[#38B000] font-bold">6 Abertas</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8FA396]">Consumo Acumulado:</span>
                    <strong className="block text-sm text-emerald-400 font-bold">R$ {totalActiveValue.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activeTables.map((t) => (
                    <div key={t.id} className="p-2.5 bg-[#06100A]/60 rounded-xl border border-[#16301F]/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-[#F2F7F3]">{t.name}</span>
                        <span className="text-[10px] text-[#8FA396] block">Atendente: {t.waiters} · {t.itemsCount} itens</span>
                      </div>
                      <div className="text-right font-bold text-[#38B000]">
                        R$ {t.total.toFixed(2)}
                        <span className="text-[10px] text-[#8FA396] block font-normal">{t.durationMinutes} min</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/app/mesas"
                  onClick={() => setSelectedKpiModal(null)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#008000] py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] transition"
                >
                  Ir para Mapa de Mesas Completo →
                </Link>
              </div>
            )}

            {selectedKpiModal === 'faturamento' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#06100A] rounded-xl border border-[#16301F] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#8FA396]">Total Bruto Hoje:</span>
                    <strong className="block text-base text-emerald-400 font-black">R$ {todayRevenueTotal.toFixed(2)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8FA396]">Vendas Fechadas:</span>
                    <strong className="block text-sm text-[#38B000] font-bold">{todayCompletedCount} Pedidos</strong>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <span className="font-bold text-[#8FA396] text-[10px] uppercase tracking-wider block">Detalhamento por Meio de Pagamento:</span>
                  {Object.keys(faturamentoHoje.byMethod).length === 0 ? (
                    <p className="text-[#8FA396] text-[11px] italic p-2">Nenhuma venda fechada hoje ainda.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(faturamentoHoje.byMethod).map(([method, { cents, count }]) => {
                        const meta = PAYMENT_METHOD_LABELS[method] ?? { label: method, emoji: '💰' };
                        return (
                          <div key={method} className="p-2 bg-[#06100A]/60 rounded-xl border border-[#16301F]/60">
                            <span className="text-[#8FA396] text-[10px]">{meta.emoji} {meta.label}</span>
                            <p className="font-bold text-emerald-400">R$ {(cents / 100).toFixed(2)} ({count}x)</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-[#06100A] rounded-xl border border-[#16301F] text-xs flex justify-between">
                  <span className="text-[#8FA396]">Ticket Médio Calculado:</span>
                  <strong className="text-[#38B000] font-bold">R$ {ticketMedio.toFixed(2)} / pedido</strong>
                </div>

                <Link
                  href="/rentabilidade"
                  onClick={() => setSelectedKpiModal(null)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#008000] py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] transition"
                >
                  Ver DRE & Relatório Detalhado →
                </Link>
              </div>
            )}

            {selectedKpiModal === 'kds' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#06100A] rounded-xl border border-[#16301F] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#8FA396]">Fila Ativa na Cozinha:</span>
                    <strong className="block text-sm text-orange-400 font-bold">{kitchenOrders.length} Pedidos</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8FA396]">Status:</span>
                    <strong className="block text-sm text-[#38B000] font-bold">
                      {kitchenOrders.length > 0 ? 'Fila em Andamento' : 'Cozinha sem Fila'}
                    </strong>
                  </div>
                </div>

                <div className="space-y-2 text-xs max-h-56 overflow-y-auto pr-1">
                  {kitchenOrders.length === 0 ? (
                    <div className="p-4 text-center text-[#8FA396] bg-[#06100A]/40 rounded-xl border border-dashed border-[#16301F]">
                      Nenhum pedido pendente na cozinha no momento.
                    </div>
                  ) : (
                    kitchenOrders.map((ord) => (
                      <div key={ord.id} className="p-2.5 bg-[#06100A]/60 rounded-xl border border-amber-500/40 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#F2F7F3]">{ord.customerName || `Pedido #${ord.id}`}</span>
                          <span className="text-[10px] text-amber-400 block">Status: {ord.status === 'preparing' ? 'Em Preparo' : 'Recebido'}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#38B000]">{ord.items?.length || 1} itens</span>
                      </div>
                    ))
                  )}
                </div>

                <Link
                  href="/app/cozinha"
                  onClick={() => setSelectedKpiModal(null)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#008000] py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] transition"
                >
                  Abrir Tela Cheia KDS Cozinha →
                </Link>
              </div>
            )}

            {selectedKpiModal === 'delivery' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#06100A] rounded-xl border border-[#16301F] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#8FA396]">Entregas Ativas (Malha MIAR):</span>
                    <strong className="block text-sm text-blue-400 font-bold">{deliveryOffers.length} Pedidos</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8FA396]">Aguardando Motoboy:</span>
                    <strong className="block text-sm text-amber-400 font-bold">
                      {deliveryOffers.filter(o => o.status === 'PENDING').length}
                    </strong>
                  </div>
                </div>

                <div className="space-y-2 text-xs max-h-56 overflow-y-auto pr-1">
                  {deliveryOffers.length === 0 ? (
                    <div className="p-4 text-center text-[#8FA396] bg-[#06100A]/40 rounded-xl border border-dashed border-[#16301F]">
                      Nenhuma entrega ativa no momento.
                    </div>
                  ) : (
                    deliveryOffers.map((offer) => (
                      <div key={offer.id} className="p-2.5 bg-[#06100A]/60 rounded-xl border border-blue-500/40 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#F2F7F3]">Pedido #{offer.orderId.substring(0,6)}</span>
                          <span className="text-[10px] text-blue-400 block">Status: {offer.status}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400 block">R$ {offer.price.toFixed(2)}</span>
                          {offer.driverId && <span className="text-[10px] text-[#8FA396]">Driver ID: {offer.driverId.substring(0,4)}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-400 border border-slate-700">
                  ⚠️ Abra o 'KDS Logística' na tela da equipe para aceitar/cancelar.
                </div>
              </div>
            )}

            {selectedKpiModal === 'ia' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#06100A] rounded-xl border border-[#16301F] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#8FA396]">Motor de Inteligência MIAR:</span>
                    <strong className="block text-sm text-emerald-400 font-bold">100% Operacional</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8FA396]">Ajustes Recomendados:</span>
                    <strong className="block text-sm text-[#38B000] font-bold">2 Oportunidades</strong>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-[#06100A]/60 rounded-xl border border-[#16301F]/60">
                    <span className="font-bold text-[#38B000] block">📈 Sugestão de Sugestionamento Automático</span>
                    <p className="text-[11px] text-[#8FA396] mt-0.5">
                      Oferecer Chopp Artesanal na comanda aumenta a margem bruta em 14%.
                    </p>
                  </div>
                  <div className="p-2.5 bg-[#06100A]/60 rounded-xl border border-[#16301F]/60">
                    <span className="font-bold text-amber-400 block">📦 Controle Preditivo de Insumos</span>
                    <p className="text-[11px] text-[#8FA396] mt-0.5">
                      Nível de "Filé Mignon" suficiente para mais 1.5 dias de operação.
                    </p>
                  </div>
                </div>

                <Link
                  href="/minha-ia"
                  onClick={() => setSelectedKpiModal(null)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#008000] py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] transition"
                >
                  Abrir Copilot de Inteligência Ária →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
