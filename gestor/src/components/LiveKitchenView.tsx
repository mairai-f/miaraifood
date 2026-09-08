import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, AlertCircle, CheckCircle2, Sparkles, Table2, Wallet, Salad, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

/**
 * LiveKitchenView — KDS real da Cozinha, embutido no artifacts/gestor via
 * KitchenRoute (App.tsx). Substitui o antigo KitchenView (que era um mock
 * inteiramente baseado em localStorage 'miar-kitchen-orders', sem nenhuma
 * ligação com pedidos reais).
 *
 * Fonte de dados: GET /api/orders (api-server/src/routes/orders.ts), já
 * filtrado por restaurantId no backend a partir do token (requireAnyAuth).
 * Tempo real: assina o mesmo stream SSE global já usado por
 * artifacts/equipe/src/components/WaiterCallListener.tsx (GET /api/events,
 * api-server/src/lib/sse.ts) — nos eventos "order:new" (tables.ts, fluxo de
 * pedido dine-in) e "order:ready" (operational-workflow.ts) refaz o fetch.
 *
 * Classificação em 3 colunas usa a mesma regra pura do backend
 * (api-server/src/lib/kitchen-insight.ts: classifyKitchenOrder), replicada
 * aqui no cliente pra não depender de um round-trip extra por pedido.
 *
 * Ingredientes por item: cruza GET /api/restaurants/me/menu-completo
 * (retorna MenuItem completo, incluindo fichaTecnica — rota com
 * requireAnyAuth, então funciona tanto pro dono quanto pro cozinheiro
 * logado via PIN) com GET /api/stock (nomes dos insumos referenciados na
 * ficha técnica). Prato sem ficha técnica cadastrada cai no fallback:
 * mostra a descrição do prato — nunca inventa ingrediente.
 */

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface KitchenOrder {
  id: string;
  tableNumber: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'cancelled';
  items: OrderItem[];
  total: number;
  createdAt: string;
  estimatedMinutes: number;
  customerName?: string;
  columnOverride?: 'andamento' | 'atrasado';
  /** Quem lançou o pedido — cliente via qrmenu ({ type: 'client' }) ou
   * funcionário/dono via "Lançar Pedido" em mesas.tsx ({ type: 'waiter', name }).
   * Ausente em pedidos criados antes desse campo existir. */
  placedBy?: { type: 'client' } | { type: 'waiter'; name: string };
}

interface FichaTecnicaIngrediente {
  stockItemId: string;
  quantidadePorUnidade: number;
}

interface MenuItemDetail {
  id: string;
  description?: string;
  fichaTecnica?: FichaTecnicaIngrediente[];
}

interface StockItemName {
  id: string;
  name: string;
}

type Column = 'andamento' | 'atrasado' | 'pronto';

function classify(order: KitchenOrder, now: number): Column {
  if (order.status === 'ready' || order.status === 'delivered' || order.status === 'paid') return 'pronto';
  if (order.columnOverride) return order.columnOverride;
  const deadline = new Date(order.createdAt).getTime() + order.estimatedMinutes * 60_000;
  if (Number.isFinite(deadline) && now > deadline) return 'atrasado';
  return 'andamento';
}

function getStoredToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token');
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function elapsedMinutes(createdAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
}

const COLUMN_META: Record<Column, { title: string; icon: typeof ChefHat; accent: string }> = {
  andamento: { title: 'Em andamento', icon: ChefHat, accent: 'text-[#38B000] border-[#16301F]' },
  atrasado: { title: 'Atrasados', icon: AlertCircle, accent: 'text-rose-300 border-rose-500/50' },
  pronto: { title: 'Prontos', icon: CheckCircle2, accent: 'text-emerald-300 border-emerald-500/40' },
};

/** Ingredientes de um item a partir da ficha técnica (nomes reais do
 * estoque). Sem ficha técnica cadastrada, cai pra descrição do prato — nunca
 * inventa ingrediente que não existe. */
function ingredientesDoItem(
  item: OrderItem,
  menuById: Map<string, MenuItemDetail>,
  stockNameById: Map<string, string>
): string | null {
  const menuItem = menuById.get(item.menuItemId);
  if (menuItem?.fichaTecnica && menuItem.fichaTecnica.length > 0) {
    const nomes = menuItem.fichaTecnica
      .map((ing) => stockNameById.get(ing.stockItemId))
      .filter((n): n is string => Boolean(n));
    if (nomes.length > 0) return nomes.join(', ');
  }
  return menuItem?.description?.trim() || null;
}

function OrderCard({
  order,
  now,
  column,
  draggable,
  menuById,
  stockNameById,
  onDragStart,
  onMoveColumn,
  onMarkReady,
  onCancel,
}: {
  order: KitchenOrder;
  now: number;
  column: Column;
  draggable: boolean;
  menuById: Map<string, MenuItemDetail>;
  stockNameById: Map<string, string>;
  onDragStart: (order: KitchenOrder, column: Column) => void;
  onMoveColumn: (order: KitchenOrder, target: 'andamento' | 'atrasado') => void;
  onMarkReady: (order: KitchenOrder) => void;
  onCancel: (order: KitchenOrder) => void;
}) {
  const minutes = elapsedMinutes(order.createdAt, now);
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', order.id);
        onDragStart(order, column);
      }}
      className={`rounded-xl border border-[#16301F] bg-[#0B1A10] p-3 ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-90'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-manrope font-bold text-[#F2F7F3]">
          {draggable && <GripVertical className="h-3.5 w-3.5 text-[#7A8F7E] shrink-0" />}
          <Table2 className="h-3.5 w-3.5 text-[#38B000] shrink-0" />
          {order.tableNumber ? `Mesa ${order.tableNumber}` : order.customerName || `Pedido ${order.id.slice(0, 6)}`}
          {order.placedBy?.type === 'waiter' && (
            <span className="font-normal text-[#8FA396]"> — Garçom {order.placedBy.name}</span>
          )}
        </span>
        <span className="text-xs text-[#8FA396] shrink-0">{minutes} min</span>
      </div>

      <ul className="mt-2.5 space-y-2">
        {order.items.map((item) => {
          const ingredientes = ingredientesDoItem(item, menuById, stockNameById);
          return (
            <li key={item.id} className="rounded-lg bg-[#06100A] border border-[#16301F]/60 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#F2F7F3]">
                  {item.quantity}x {item.name}
                </span>
                <span className="flex items-center gap-1 text-xs font-manrope font-black text-[#38B000] shrink-0">
                  <Wallet className="h-3 w-3" /> R$ {(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
              {ingredientes && (
                <p className="mt-0.5 flex items-start gap-1 text-[10px] text-[#8FA396] leading-snug">
                  <Salad className="h-3 w-3 mt-0.5 shrink-0 text-[#7A8F7E]" />
                  {ingredientes}
                </p>
              )}
              {item.notes && (
                <p className="mt-0.5 text-[10px] text-[#7A8F7E] italic">Obs: {item.notes}</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 pt-2 border-t border-[#16301F]/60 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[#8FA396]">Total do pedido</span>
        <span className="text-sm font-manrope font-black text-[#38B000]">R$ {order.total.toFixed(2)}</span>
      </div>

      {/* Botões — mesma ação do arrastar, pra quem preferir tocar em vez de
          arrastar (ou não conseguir arrastar bem no celular). */}
      {column !== 'pronto' && (
        <div className="mt-2 flex gap-1.5">
          {column !== 'andamento' && (
            <button
              type="button"
              onClick={() => onMoveColumn(order, 'andamento')}
              className="flex-1 rounded-lg border border-[#16301F] bg-[#06100A] px-2 py-1.5 text-[10px] font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
            >
              ← Em andamento
            </button>
          )}
          {column !== 'atrasado' && (
            <button
              type="button"
              onClick={() => onMoveColumn(order, 'atrasado')}
              className="flex-1 rounded-lg border border-[#16301F] bg-[#06100A] px-2 py-1.5 text-[10px] font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
            >
              Atrasado →
            </button>
          )}
          <button
            type="button"
            onClick={() => onMarkReady(order)}
            className="flex-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-[10px] font-bold text-[#0d1b1a] hover:bg-emerald-400"
          >
            ✓ Pronto
          </button>
          <button
            type="button"
            onClick={() => onCancel(order)}
            title="Cancelar pedido"
            className="rounded-lg border border-red-900/50 bg-red-950/30 px-2 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-600 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function LiveKitchenView() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [insight, setInsight] = useState<string | null>(null);

  const [menuById, setMenuById] = useState<Map<string, MenuItemDetail>>(new Map());
  const [stockNameById, setStockNameById] = useState<Map<string, string>>(new Map());
  // Drag-and-drop: qual pedido está sendo arrastado e de qual coluna ele saiu
  // — decide o que uma soltura em cada coluna-alvo pode fazer (ver regras
  // abaixo, em handleDrop).
  const [dragging, setDragging] = useState<{ order: KitchenOrder; from: Column } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Column | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders', { headers: authHeaders() });
      if (!res.ok) return;
      const data = (await res.json()) as KitchenOrder[];
      if (Array.isArray(data)) {
        setOrders(data.filter((o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready'));
      }
    } catch {
      /* rede instável — mantém a última lista carregada */
    }
  }, []);

  const loadInsight = useCallback(async () => {
    try {
      const res = await fetch('/api/kitchen/insight', { headers: authHeaders() });
      if (!res.ok) return;
      const data = (await res.json()) as { message?: string };
      if (data.message) setInsight(data.message);
    } catch {
      /* banner de IA é só um extra — nunca deve travar o KDS */
    }
  }, []);

  // Cardápio (com ficha técnica) + nomes dos insumos de estoque — carregado
  // uma vez (não muda com a mesma frequência dos pedidos). Ambas as rotas
  // usam requireAnyAuth, então funcionam com o token do cozinheiro (PIN) ou
  // do dono, igual GET /orders.
  const loadMenuAndStock = useCallback(async () => {
    try {
      const [menuRes, stockRes] = await Promise.all([
        fetch('/api/restaurants/me/menu-completo', { headers: authHeaders() }),
        fetch('/api/stock', { headers: authHeaders() }),
      ]);
      if (menuRes.ok) {
        const menuData = (await menuRes.json()) as MenuItemDetail[];
        if (Array.isArray(menuData)) {
          setMenuById(new Map(menuData.map((m) => [m.id, m])));
        }
      }
      if (stockRes.ok) {
        const stockData = (await stockRes.json()) as StockItemName[];
        if (Array.isArray(stockData)) {
          setStockNameById(new Map(stockData.map((s) => [s.id, s.name])));
        }
      }
    } catch {
      /* sem cardápio/estoque carregado, os cards caem no fallback (sem ingredientes) */
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadInsight();
    loadMenuAndStock();
    // Refresh de "now" a cada minuto pra recalcular atrasos sem depender de evento.
    const clockInterval = setInterval(() => setNow(Date.now()), 60_000);
    // Insight é reconsultado periodicamente (é uma sugestão, não precisa de tempo real estrito).
    const insightInterval = setInterval(loadInsight, 90_000);

    const source = new EventSource('/api/events');
    const refetch = () => { loadOrders(); loadInsight(); };
    source.addEventListener('order:new', refetch);
    source.addEventListener('order:ready', refetch);
    source.addEventListener('order:cancelled', refetch);
    // Garçom confirmou entrega na mesa (mesas.tsx markDelivered) — some da
    // fila de "pronto" na hora, sem esperar o próximo poll (05/09/2026).
    source.addEventListener('order:delivered', refetch);

    return () => {
      clearInterval(clockInterval);
      clearInterval(insightInterval);
      source.removeEventListener('order:new', refetch);
      source.removeEventListener('order:ready', refetch);
      source.removeEventListener('order:cancelled', refetch);
      source.removeEventListener('order:delivered', refetch);
      source.close();
    };
  }, [loadOrders, loadInsight, loadMenuAndStock]);

  const columns = useMemo(() => {
    const grouped: Record<Column, KitchenOrder[]> = { andamento: [], atrasado: [], pronto: [] };
    for (const order of orders) {
      // CORRIGIDO 04/09/2026: pedido marcado "entregue" (garçom já pegou no
      // balcão e levou pra mesa) ficava preso pra sempre na coluna "pronto"
      // — a cozinha nunca via ela esvaziar de verdade. O board da cozinha só
      // faz sentido pro que ainda precisa de atenção da cozinha; "entregue"
      // e "pago" já saíram do fluxo dela.
      if (order.status === 'delivered' || order.status === 'paid' || order.status === 'cancelled') continue;
      grouped[classify(order, now)].push(order);
    }
    for (const key of Object.keys(grouped) as Column[]) {
      grouped[key].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return grouped;
  }, [orders, now]);

  // Marca o pedido como pronto no backend real — mesma rota que a Cozinha já
  // usava antes (PATCH /orders/:id/status, api-server/src/routes/orders.ts),
  // que já dispara o broadcast SSE "order:ready" lido pelo garçom
  // (WaiterCallListener). Arrastar pra "Pronto" não cria um caminho paralelo.
  const markOrderReady = useCallback(async (order: KitchenOrder) => {
    // Atualização otimista — some da coluna de origem na hora, sem esperar o
    // round-trip, e o loadOrders() logo depois reconcilia com o servidor.
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'ready' } : o)));
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: 'ready' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Não foi possível marcar o pedido como pronto.');
      }
      toast.success(`Mesa ${order.tableNumber || ''} marcada como pronta!`);
      await loadOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível marcar o pedido como pronto.');
      await loadOrders(); // desfaz a atualização otimista se o backend recusou
    }
  }, [loadOrders]);

  // Cancela o pedido — some do board e a cozinha para de preparar. Só faz
  // sentido antes de "entregue"/"pago" (ver guard no backend). CORRIGIDO
  // 04/09/2026: confirmação era window.confirm() nativo do navegador —
  // trocado por modal próprio do sistema (ver pendingCancel + JSX no fim
  // do componente), consistente com o resto da UI.
  const [pendingCancel, setPendingCancel] = useState<KitchenOrder | null>(null);
  const cancelOrder = useCallback((order: KitchenOrder) => {
    setPendingCancel(order);
  }, []);
  const confirmCancelOrder = useCallback(async () => {
    const order = pendingCancel;
    if (!order) return;
    setPendingCancel(null);
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Não foi possível cancelar o pedido.');
      }
      toast.success(`Pedido da Mesa ${order.tableNumber || ''} cancelado.`);
      await loadOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar o pedido.');
      await loadOrders();
    }
  }, [pendingCancel, loadOrders]);

  // CORRIGIDO 04/09/2026 (pedido do dono do sistema): "andamento" <->
  // "atrasado" agora aceita override manual de verdade — PATCH
  // /orders/:id/column grava columnOverride no pedido, que
  // classifyKitchenOrder passa a respeitar (vence a conta por tempo, exceto
  // quando o pedido já está pronto). Fica valendo até o cozinheiro mudar de
  // novo. "pronto" continua terminal (cards de lá não são arrastáveis) e só
  // é setado de verdade via PATCH /orders/:id/status.
  const moveOrderColumn = useCallback(async (order: KitchenOrder, targetColumn: 'andamento' | 'atrasado') => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, columnOverride: targetColumn } : o)));
    try {
      const res = await fetch(`/api/orders/${order.id}/column`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ column: targetColumn }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Não foi possível mover o pedido.');
      }
      await loadOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível mover o pedido.');
      await loadOrders();
    }
  }, [loadOrders]);

  const handleDrop = useCallback((targetColumn: Column) => {
    setDragOverColumn(null);
    if (!dragging) return;
    const { order, from } = dragging;
    setDragging(null);
    if (from === targetColumn) return;
    if (targetColumn === 'pronto') {
      markOrderReady(order);
      return;
    }
    moveOrderColumn(order, targetColumn);
  }, [dragging, markOrderReady, moveOrderColumn]);

  return (
    <div className="w-full text-[#F2F7F3] font-inter">
      {insight && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#008000]/40 bg-[#0B1A10] px-4 py-3 text-sm text-[#38B000]">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{insight}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(['andamento', 'atrasado', 'pronto'] as Column[]).map((col) => {
          const meta = COLUMN_META[col];
          const Icon = meta.icon;
          const isDragOver = dragOverColumn === col && dragging && dragging.from !== col;
          return (
            <div
              key={col}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverColumn !== col) setDragOverColumn(col);
              }}
              onDragLeave={() => setDragOverColumn((prev) => (prev === col ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col);
              }}
              className={`rounded-2xl border bg-[#06100A] p-3 transition-all ${meta.accent} ${isDragOver ? 'ring-2 ring-[#008000]/70' : ''}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className={`flex items-center gap-2 font-manrope font-extrabold ${meta.accent.split(' ')[0]}`}>
                  <Icon className="h-4 w-4" />
                  {meta.title}
                </div>
                <span className="rounded-full bg-[#0B1A10] px-2 py-0.5 text-xs">{columns[col].length}</span>
              </div>
              {/* Rolagem própria por coluna — com muitos pedidos simultâneos
                  a coluna não deve empurrar a página inteira pra baixo. */}
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {columns[col].length === 0 && (
                  <p className="text-xs text-[#7A8F7E]">Nenhum pedido nesta coluna.</p>
                )}
                {columns[col].map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    now={now}
                    column={col}
                    draggable={col !== 'pronto'}
                    menuById={menuById}
                    stockNameById={stockNameById}
                    onDragStart={(o, from) => setDragging({ order: o, from })}
                    onMoveColumn={moveOrderColumn}
                    onMarkReady={markOrderReady}
                    onCancel={cancelOrder}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmação de cancelamento — modal próprio do sistema, não window.confirm() nativo. */}
      {pendingCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4"
          onClick={() => setPendingCancel(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-red-900/50 bg-[#0B1A10] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-400 font-manrope font-bold text-base">
              <AlertCircle className="h-5 w-5" />
              Cancelar pedido?
            </div>
            <p className="mt-2 text-sm text-[#8FA396]">
              Mesa {pendingCancel.tableNumber || ''} — essa ação não pode ser desfeita. A cozinha para de preparar esse pedido.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingCancel(null)}
                className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmCancelOrder}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500"
              >
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
