import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Table2,
  Plus,
  QrCode,
  Copy,
  Printer,
  Utensils,
  ChefHat,
  Bell,
  CreditCard,
  CheckCircle2,
  Clock,
  X,
  Search,
  Users,
  Send,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/IdiomaContext';
import { DraggableScroll } from '../components/ui/draggable-scroll';
import { decodeJwtPayload } from '../lib/jwt';
// CORRIGIDO (03/09/2026): "Fechar Conta" (finalizePayment abaixo) usava
// createAndCompleteOrder (../lib/order-service), que grava numa tabela
// Supabase 'orders'/'order_items' totalmente separada — nunca lida por mais
// nada neste app (confirmado: nenhum outro arquivo em artifacts/gestor/src
// importa order-service) — e nunca tocava os pedidos REAIS da cozinha
// (api-server's orders array/tabela Postgres, os mesmos que LiveKitchenView
// lê). Isso deixava pedidos reais presos num status não-terminal pra
// sempre. Trocado pelo endpoint real de fechamento de mesa,
// POST /api/tables/by-token/:token/session/close (api-server/src/routes/tables.ts),
// que já marca o pedido real da cozinha como "paid" (ver kitchenOrder.status
// = "paid" nessa rota).

type TableStatus = 'free' | 'occupied' | 'preparing' | 'ready' | 'payment_pending';

// ─── Pedido real vindo do backend (api-server/src/routes/orders.ts) ───────────
interface BackendOrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  status: 'pending' | 'preparing' | 'ready';
  notes?: string;
}

interface BackendOrder {
  id: string;
  tableId: string;
  tableNumber: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'cancelled';
  items: BackendOrderItem[];
  total: number;
  createdAt: string;
}

interface BackendTable {
  id: string;
  number: number;
  seats: number;
  status: 'free' | 'occupied' | 'reserved' | 'cleaning' | 'paid';
  qrToken: string;
}

function getAuthToken(): string {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
}

// Migração pra domínio próprio (05/09/2026): enquanto Gestor e QRMenu
// dividem o mesmo domínio (pipeline compartilhado, path-based), o link/QR
// da mesa é "<origin>/menu?qr=...". Assim que o QRMenu virar um domínio
// próprio (VITE_QRMENU_URL setado), esse app já FICA na raiz — vira
// "<VITE_QRMENU_URL>?qr=..." sem o prefixo "/menu".
function qrmenuLink(qrToken: string): string {
  const qrmenuUrl = import.meta.env.VITE_QRMENU_URL as string | undefined;
  const base = qrmenuUrl ?? `${window.location.origin}/menu`;
  return `${base}?qr=${encodeURIComponent(qrToken)}`;
}

function authedHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Deriva o status visual da mesa (usado pela grade/filtros) a partir do
 * status real da mesa no backend + dos pedidos ativos associados a ela. */
function deriveTableStatus(backendStatus: BackendTable['status'], activeOrders: BackendOrder[]): TableStatus {
  if (backendStatus === 'cleaning' || backendStatus === 'paid') return 'payment_pending';
  if (activeOrders.length === 0) {
    return backendStatus === 'free' ? 'free' : 'occupied';
  }
  const allReady = activeOrders.every((o) => o.status === 'ready' || o.status === 'delivered');
  return allReady ? 'ready' : 'preparing';
}

type OrderItem = {
  id: string;
  /** Pedido (Order) real que este item pertence — necessário pra marcar "entregue" via PATCH /orders/:id/status. */
  orderId: string;
  name: string;
  qty: number;
  price: number;
  category?: string;
  status: 'preparing' | 'ready' | 'delivered';
  notes?: string;
};

type TableRecord = {
  id: string;
  number: number;
  seats: number;
  status: TableStatus;
  qrToken: string;
  orders: OrderItem[];
  total: number;
  openedAt?: string;
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
};

const DEFAULT_CATEGORIZED_MENU: MenuItem[] = [
  // Hambúrgueres / Lanches
  { id: 'm1', name: 'X-Tudo Especial MIAR', price: 34.90, category: 'Hambúrgueres' },
  { id: 'm2', name: 'Smash Burger Duplo Cheddar', price: 29.90, category: 'Hambúrgueres' },
  { id: 'm3', name: 'Burger Crispy de Frango', price: 27.50, category: 'Hambúrgueres' },
  
  // Pizzas
  { id: 'm4', name: 'Pizza Grande Calabresa Especial', price: 59.90, category: 'Pizzas' },
  { id: 'm5', name: 'Pizza Quatro Queijos Gourmet', price: 64.90, category: 'Pizzas' },
  
  // Bebidas
  { id: 'm6', name: 'Refrigerante Lata 350ml', price: 7.50, category: 'Bebidas' },
  { id: 'm7', name: 'Cerveja Heineken Long Neck', price: 14.90, category: 'Bebidas' },
  { id: 'm8', name: 'Chopp Artesanal 500ml', price: 16.00, category: 'Bebidas' },

  // Sucos
  { id: 'm9', name: 'Suco Natural de Laranja 500ml', price: 12.00, category: 'Sucos' },
  { id: 'm10', name: 'Suco de Abacaxi com Hortelã', price: 14.00, category: 'Sucos' },

  // Pratos
  { id: 'm11', name: 'Picanha na Chapa com Fritas', price: 89.90, category: 'Pratos' },
  { id: 'm12', name: 'Filé à Parmegiana Executivo', price: 42.00, category: 'Pratos' },

  // Porções
  { id: 'm13', name: 'Porção de Batata Frita Supreme', price: 38.00, category: 'Porções' },
  { id: 'm14', name: 'Isca de Tilápia Crocante', price: 48.00, category: 'Porções' },

  // Sobremesas
  { id: 'm15', name: 'Pudim de Leite Condensado', price: 14.00, category: 'Sobremesas' },
  { id: 'm16', name: 'Petit Gâteau com Sorvete', price: 24.00, category: 'Sobremesas' },
];

export default function Mesas() {
  const { t } = useTranslation();
  // CORRIGIDO 05/09/2026 (bug real em produção): o estado inicial vinha de
  // um placeholder de 8-20 mesas fictícias lido de localStorage
  // ('miar-tables-count'/'miar-onboarding-full-data', chaves que nenhuma
  // tela do sistema jamais escreve — eram só um resquício de protótipo).
  // Isso fazia a tela "piscar" um número de mesas que nunca existiu de
  // verdade, e assim que o fetch real em GET /tables voltava (0 mesas, pra
  // uma conta nova), tudo sumia — parecendo bug de "mesas desaparecendo".
  // Agora começa vazio de verdade e mostra um estado de "criar mesas"
  // explícito (ver hasLoadedOnce/isCriarMesasOpen abaixo) até a primeira
  // resposta real do backend chegar.
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isCriarMesasOpen, setIsCriarMesasOpen] = useState(false);
  const [criarMesasQtd, setCriarMesasQtd] = useState('8');
  const [criandoMesas, setCriandoMesas] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'occupied' | 'free' | 'preparing' | 'ready' | 'payment'>('all');
  // Paginação (05/09/2026, pedido explícito): mostrar 20/50/100 mesas por
  // vez em vez do grid inteiro de uma vez — evita travar a tela numa conta
  // com muitas mesas. Dropdown fica no topo, junto dos outros controles.
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20);
  const tablesGridRef = useRef<HTMLDivElement | null>(null);
  const goToFilter = (tab: typeof filterTab) => {
    setFilterTab(tab);
    tablesGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const [searchQuery, setSearchQuery] = useState('');

  // Menu Items (Merged with Admin Config / LocalStorage)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(DEFAULT_CATEGORIZED_MENU);

  // Modals
  const [selectedTable, setSelectedTable] = useState<TableRecord | null>(null);
  // Mesas com "chamar garçom" pendente (waiter:call via SSE) — pisca até o
  // garçom abrir a mesa ou dispensar.
  const [calledTables, setCalledTables] = useState<Set<number>>(new Set());
  const [markingDelivered, setMarkingDelivered] = useState<string | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [qrSize, setQrSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Categorized Order Launch Form State
  const [orderModalCategory, setOrderModalCategory] = useState<string>('Todos');
  const [orderModalSearch, setOrderModalSearch] = useState<string>('');
  const [orderCart, setOrderCart] = useState<{ item: MenuItem; qty: number; notes: string }[]>([]);

  // Payment Form State
  const [splitCount, setSplitCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit' | 'cash'>('pix');
  const [qrDataUrl, setQrDataUrl] = useState('');
  // Trava de duplo-clique — sem isso, uma resposta de rede lenta deixa o
  // caixa clicar "Fechar Conta" mais de uma vez e disparar o fechamento
  // (e a tentativa de baixa de pedido) duas vezes.
  const [isFinalizing, setIsFinalizing] = useState(false);

  // New Table Form State
  const [isNewTableOpen, setIsNewTableOpen] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newSeats, setNewSeats] = useState('4');

  // Gate do botão "+ Nova Mesa" pela permissão granular real do funcionário
  // (EmployeePermissions.manageTables em api-server/src/lib/data-store.ts),
  // a mesma flag que já protege POST /tables no backend
  // (requireEmployeePermission("manageTables") em routes/tables.ts). Sem
  // login-miar.tsx ter salvo 'miar-employee-permissions' (login Operacional
  // via /api/employees/verify-pin) significa sessão de dono — sempre libera.
  const canManageTables = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('miar-employee-permissions');
      if (!raw) return true; // dono (preview) ou sessão sem esse dado — comportamento anterior
      const perms = JSON.parse(raw) as { manageTables?: boolean };
      return Boolean(perms.manageTables);
    } catch {
      return true;
    }
  }, []);

  // Garçom QR Code Auto-Select: Se a URL contiver ?mesa=X, abre a mesa automaticamente
  // Mantém selectedTable sincronizado com a lista real — sem isso, o modal
  // aberto (itens/pedidos da mesa) ficava congelado na hora do clique,
  // então marcar entregue/cancelar dentro do modal não refletia na tela até
  // fechar e abrir de novo.
  useEffect(() => {
    if (!selectedTable) return;
    const fresh = tables.find((t) => t.id === selectedTable.id);
    if (fresh && fresh !== selectedTable) setSelectedTable(fresh);
  }, [tables, selectedTable]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesaParam = params.get('mesa') || params.get('mesaId');
    if (mesaParam && tables.length > 0) {
      const num = parseInt(mesaParam, 10);
      const found = tables.find((t) => t.number === num);
      if (found) {
        setSelectedTable(found);
        setIsOrderModalOpen(true);
        toast.success(`📍 Garçom: Mesa ${num} identificada via QR Code!`);
      }
    }
  }, []);

  // Prevent background body scrolling when any modal is open
  const isAnyModalOpen = isOrderModalOpen || isPaymentModalOpen || isQrModalOpen || isNewTableOpen || isScannerOpen;
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAnyModalOpen]);

  // Load configured catalog items from backend.
  //
  // CORRIGIDO 04/09/2026: isto chamava GET /api/menu/items, uma rota
  // owner-only (requireOwnerAuth) — quando quem está logado é um garçom
  // (token de funcionário), essa chamada sempre dava 401, o .catch/fallback
  // silencioso deixava `data` como [], e como `data.length > 0` era falso,
  // `setMenuItems` NUNCA era chamado — o garçom ficava pra sempre com
  // `DEFAULT_CATEGORIZED_MENU` (produtos fictícios de demonstração, sem
  // `id` real no backend). Qualquer pedido lançado com esses ids sempre
  // falhava com "Item de cardápio inválido" em POST /orders. Trocado pro
  // endpoint público de cardápio (GET /restaurants/:id/menu, sem auth —
  // mesmo que o artifacts/qrmenu já usa), que funciona pra dono E
  // funcionário igual, e já vem com foto/ingredientes.
  useEffect(() => {
    const token = window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token');
    const companyId = decodeJwtPayload(token)?.companyId;
    if (!companyId) return;
    fetch(`/api/restaurants/${companyId}/menu`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: MenuItem[] = data
            .filter((d: any) => d.available !== false)
            .map((d: any) => ({
              id: d.id,
              name: d.name,
              price: Number(d.price) || 0,
              category: d.category || 'Geral',
            }));
          setMenuItems(mapped);
        }
      })
      .catch(() => {});
  }, []);

  // ─── Mesas & Pedidos reais (backend) ─────────────────────────────────────
  // Fonte de verdade: GET /api/tables (api-server/src/routes/tables.ts) e
  // GET /api/orders (api-server/src/routes/orders.ts) — o mesmo par que a
  // Cozinha (LiveKitchenView) já usa.
  const loadRealTablesAndOrders = useCallback(async () => {
    try {
      const [tablesRes, ordersRes] = await Promise.all([
        fetch('/api/tables', { headers: authedHeaders() }),
        fetch('/api/orders', { headers: authedHeaders() }),
      ]);
      if (!tablesRes.ok) return;
      const backendTables = (await tablesRes.json()) as BackendTable[];
      const backendOrders: BackendOrder[] = ordersRes.ok ? await ordersRes.json() : [];
      if (!Array.isArray(backendTables)) return;

      const ordersByTable: Record<string, BackendOrder[]> = {};
      for (const order of Array.isArray(backendOrders) ? backendOrders : []) {
        if (order.status === 'paid' || order.status === 'cancelled') continue; // conta já fechada ou pedido cancelado — não deve aparecer como pedido ativo da mesa
        (ordersByTable[order.tableId] ??= []).push(order);
      }

      setTables((prev) =>
        backendTables
          .map((bt): TableRecord => {
            const activeOrders = ordersByTable[bt.id] ?? [];
            // CORRIGIDO 04/09/2026: antes "ready" e "delivered" caíam no mesmo
            // rótulo "pronto" (o ternário tratava os dois igual) — não dava
            // pra saber, olhando a mesa, se o garçom já tinha buscado o
            // pedido no balcão ou não. Também faltava o orderId em cada
            // item, então não tinha como clicar e marcar como entregue (o
            // PATCH real precisa do id do Order, não do item). Agora "ready"
            // e "delivered" ficam separados de verdade, e cada item carrega
            // o orderId do pedido que ele pertence.
            const orderItems: OrderItem[] = activeOrders.flatMap((o) =>
              o.items.map((it) => ({
                id: it.id,
                orderId: o.id,
                name: it.name,
                qty: it.quantity,
                price: it.price,
                status: o.status === 'ready' ? 'ready' : o.status === 'delivered' ? 'delivered' : 'preparing',
                notes: it.notes,
              }))
            );
            const total = activeOrders.reduce((sum, o) => sum + o.total, 0);
            const previous = prev.find((t) => t.id === bt.id);
            return {
              id: bt.id,
              number: bt.number,
              seats: bt.seats,
              status: deriveTableStatus(bt.status, activeOrders),
              qrToken: bt.qrToken,
              orders: orderItems,
              total,
              openedAt: activeOrders.length > 0 ? (previous?.openedAt ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : undefined,
            };
          })
          .sort((a, b) => a.number - b.number)
      );
      setHasLoadedOnce(true);
    } catch {
      // Rede instável / backend fora — mantém a última lista carregada.
    }
  }, []);

  const criarMesasEmLote = async () => {
    const qtd = Math.min(Math.max(parseInt(criarMesasQtd, 10) || 0, 1), 200);
    setCriandoMesas(true);
    try {
      const r = await fetch('/api/tables/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authedHeaders() },
        body: JSON.stringify({ count: qtd, seats: 4 }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error ?? 'Não foi possível criar as mesas.');
        return;
      }
      toast.success(`${qtd} mesa(s) criada(s)!`);
      setIsCriarMesasOpen(false);
      await loadRealTablesAndOrders();
    } catch {
      toast.error('Falha de conexão ao criar mesas.');
    } finally {
      setCriandoMesas(false);
    }
  };

  useEffect(() => {
    loadRealTablesAndOrders();
    const pollInterval = setInterval(loadRealTablesAndOrders, 2000);

    // Tempo real: mesmo stream SSE global que a Cozinha (LiveKitchenView) já
    // usa (api-server/src/lib/sse.ts) — refaz o fetch assim que um pedido
    // novo é lançado ou fica pronto, pra Mesas & Comandas refletir na hora.
    const source = new EventSource('/api/events');
    const refetch = () => loadRealTablesAndOrders();
    source.addEventListener('order:new', refetch);
    source.addEventListener('order:ready', refetch);
    source.addEventListener('order:cancelled', refetch);

    // CORRIGIDO 04/09/2026: o botão "chamar garçom" (artifacts/qrmenu) já
    // disparava o broadcast SSE "waiter:call" (POST
    // /tables/by-token/:token/waiter-call, api-server/src/routes/qrmenu.ts)
    // desde a sessão anterior, mas ninguém ouvia esse evento aqui —
    // o listener de vibração/som só tinha sido construído pro app separado
    // artifacts/equipe, abandonado quando o garçom passou a operar dentro
    // do Gestor. Nada vibrava, tocava ou piscava porque literalmente não
    // havia nenhum addEventListener('waiter:call', ...) em lugar nenhum do
    // Gestor.
    const onWaiterCall = (e: MessageEvent) => {
      let data: { tableNumber?: number; guestName?: string } = {};
      try { data = JSON.parse(e.data); } catch { /* payload inesperado, ignora */ }
      if (typeof data.tableNumber === 'number') {
        setCalledTables((prev) => new Set(prev).add(data.tableNumber!));
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      try {
        new Audio('/sounds/waiter-call.mp3').play().catch(() => {});
      } catch { /* navegador sem suporte a Audio — segue só com o toast/vibração */ }
      toast.info(
        `🔔 Mesa ${data.tableNumber ?? '?'} chamou o garçom${data.guestName ? ` (${data.guestName})` : ''}!`,
        { duration: 8000 },
      );
    };
    source.addEventListener('waiter:call', onWaiterCall);

    return () => {
      clearInterval(pollInterval);
      source.removeEventListener('order:new', refetch);
      source.removeEventListener('order:ready', refetch);
      source.removeEventListener('order:cancelled', refetch);
      source.removeEventListener('waiter:call', onWaiterCall);
      source.close();
    };
  }, [loadRealTablesAndOrders]);

  // Unique Categories configured by Admin
  const availableCategories = useMemo(() => {
    const cats = [...new Set(menuItems.map((m) => m.category))];
    return ['Todos', ...cats];
  }, [menuItems]);

  // Filtered Menu Items for Order Launch Modal
  const filteredOrderMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = orderModalCategory === 'Todos' || item.category === orderModalCategory;
      const matchSearch = !orderModalSearch || item.name.toLowerCase().includes(orderModalSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, orderModalCategory, orderModalSearch]);

  // Filtered Tables List
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchSearch = `Mesa ${t.number}`.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (filterTab === 'occupied') return t.status !== 'free';
      if (filterTab === 'free') return t.status === 'free';
      if (filterTab === 'preparing') return t.status === 'preparing';
      if (filterTab === 'ready') return t.status === 'ready';
      if (filterTab === 'payment') return t.status === 'payment_pending';
      return true;
    });
  }, [tables, filterTab, searchQuery]);

  const paginatedTables = useMemo(() => filteredTables.slice(0, pageSize), [filteredTables, pageSize]);

  // Stat Counters
  const stats = useMemo(() => {
    const total = tables.length;
    const occupied = tables.filter((t) => t.status !== 'free').length;
    const free = tables.filter((t) => t.status === 'free').length;
    const preparing = tables.filter((t) => t.status === 'preparing').length;
    const ready = tables.filter((t) => t.status === 'ready').length;
    const payment = tables.filter((t) => t.status === 'payment_pending').length;
    return { total, occupied, free, preparing, ready, payment };
  }, [tables]);

  // Handle Add Item to Order Cart
  const addToCart = (item: MenuItem) => {
    setOrderCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) => (i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { item, qty: 1, notes: '' }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setOrderCart((prev) => prev.filter((i) => i.item.id !== itemId));
  };

  // Submit New Order to Table and Kitchen — grava direto no backend real
  // (POST /api/orders, api-server/src/routes/orders.ts), que já dispara o
  // broadcast SSE "order:new" lido pela Cozinha (LiveKitchenView). Antes essa
  // função só mexia em estado local + localStorage 'miar-kitchen-orders' —
  // a Cozinha nunca via nada disso.
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const submitOrderToKitchen = async () => {
    if (!selectedTable || orderCart.length === 0) {
      toast.error('Selecione pelo menos um item para o pedido.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authedHeaders() },
        body: JSON.stringify({
          tableId: selectedTable.id,
          mode: 'dine-in',
          items: orderCart.map((c) => ({
            menuItemId: c.item.id,
            quantity: c.qty,
            notes: c.notes || undefined,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível enviar o pedido para a Cozinha.');
      }

      toast.success(`Pedido enviado para a Cozinha! Mesa ${selectedTable.number}`);
      setOrderCart([]);
      setIsOrderModalOpen(false);
      // Recarrega mesas + pedidos direto do backend — a comanda exibida
      // passa a ser sempre a real, persistida, nunca um estado local solto.
      await loadRealTablesAndOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar o pedido para a Cozinha.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Finalize Payment & Clear Table — fecha a sessão real da mesa no backend
  // (POST /tables/by-token/:token/session/close), que já marca o pedido real
  // da cozinha como "paid" e libera a mesa pra limpeza ("cleaning"). Essa
  // rota exige dono ou funcionário com a permissão closeCashier (mesma trava
  // de segurança que já existia pra liberar a mesa depois do pagamento) —
  // o backend responde 403 se quem estiver logado não tiver essa permissão,
  // e o erro chega no catch abaixo igual qualquer outra falha de rede.
  //
  // "force: true" porque este fluxo (o caixa escolhendo forma de pagamento
  // + divisão só informativa na tela) não registra pagamento por convidado
  // em session.payments — diferente do fluxo do cliente pelo qrmenu
  // (POST session/pay). Sem force, session/close recusaria com 409
  // "pendências" porque nenhum guest está marcado como pago nesse caminho.
  const finalizePayment = async () => {
    if (!selectedTable || isFinalizing) return;

    setIsFinalizing(true);
    try {
      const res = await fetch(`/api/tables/by-token/${encodeURIComponent(selectedTable.qrToken)}/session/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authedHeaders() },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível fechar a conta da mesa.');
      }

      toast.success(`Conta da Mesa ${selectedTable.number} encerrada!`);
      setIsPaymentModalOpen(false);
      setSelectedTable(null);
      // Recarrega mesas + pedidos direto do backend — a mesa aparece com o
      // status real ("cleaning" -> derivado localmente como "payment_pending")
      // em vez de forçarmos 'free' aqui, o que pularia a etapa de limpeza.
      await loadRealTablesAndOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível fechar a conta da mesa.');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Garçom clica no nome do item "pronto" pra dizer "já peguei no balcão" —
  // vira "entregue" (Order.status = 'delivered'). Mesmo PATCH que a Cozinha
  // usa pra "pronto" (orders.ts), só que o próximo status da cadeia.
  const markDelivered = async (orderId: string) => {
    setMarkingDelivered(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authedHeaders() },
        body: JSON.stringify({ status: 'delivered' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Não foi possível marcar como entregue.');
      }
      toast.success('Pedido entregue! Sumiu da fila da Cozinha.');
      await loadRealTablesAndOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível marcar como entregue.');
    } finally {
      setMarkingDelivered(null);
    }
  };

  // CORRIGIDO 04/09/2026: cancelar pedido só existia na tela da Cozinha —
  // o garçom (que lança a maioria dos pedidos e fala direto com o cliente)
  // não tinha como cancelar nada. Mesmo endpoint (POST /orders/:id/cancel),
  // mesma permissão (deleteOrders, já concedida por padrão a garçom/cozinha).
  // Confirmação é modal próprio do sistema (pendingCancelOrder + JSX no fim
  // do componente), não window.confirm() nativo.
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [pendingCancelOrder, setPendingCancelOrder] = useState<{ orderId: string; tableNumber: number } | null>(null);
  const cancelOrderAsWaiter = async (orderId: string, tableNumber: number) => {
    setCancellingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authedHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Não foi possível cancelar o pedido.');
      }
      toast.success('Pedido cancelado.');
      await loadRealTablesAndOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar o pedido.');
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Create New Table (Apenas Administrador ou Autorizado) — grava real no
  // backend (POST /api/tables), pra que o id da mesa exista de verdade e
  // "Lançar Pedido" consiga associar o pedido a ela.
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const userRole = (window.localStorage.getItem('miar-current-user-role') || 'owner').toLowerCase();
    const token = getAuthToken();
    const isAuthorized = !token || token.startsWith('admin-') || token === 'dev-bypass' || ['owner', 'admin', 'manager', 'gestor'].includes(userRole) || canManageTables;

    if (!isAuthorized) {
      toast.error('🔒 Ação Restrita: Apenas administradores ou pessoas autorizadas podem criar novas mesas.');
      return;
    }

    const num = parseInt(newNumber, 10);
    if (isNaN(num) || num <= 0) {
      toast.error('Informe um número de mesa válido.');
      return;
    }
    const seats = parseInt(newSeats, 10) || 4;

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authedHeaders() },
        body: JSON.stringify({ number: num, seats }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível criar a mesa.');
      }

      const newT: TableRecord = {
        id: data.id,
        number: data.number,
        seats: data.seats,
        status: 'free',
        qrToken: data.qrToken,
        total: 0,
        orders: [],
      };
      setTables((prev) => [...prev, newT].sort((a, b) => a.number - b.number));
      toast.success(`Mesa ${num} criada com sucesso! Gerando QR Code...`);
      setNewNumber('');
      setIsNewTableOpen(false);
      setSelectedTable(newT);
      setIsQrModalOpen(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar a mesa.');
    }
  };

  // Exportar QR Code para Impressão ou Salvar como PDF
  const exportQrToPdfOrPrint = () => {
    if (!selectedTable || !qrDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Permita popups para abrir a janela de impressão/PDF do QR Code.');
      return;
    }

    const sizePx = qrSize === 'sm' ? '180px' : qrSize === 'lg' ? '320px' : '240px';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code Display - Mesa ${selectedTable.number}</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; text-align: center; color: #06100A; margin: 0; padding: 20px; }
            .card { border: 3px solid #06100A; border-radius: 20px; padding: 30px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; margin-bottom: 5px; }
            .subtitle { font-size: 13px; color: #555; margin-bottom: 20px; }
            .qr-img { width: ${sizePx}; height: ${sizePx}; margin: 15px auto; display: block; border-radius: 12px; }
            .table-badge { background: #06100A; color: #008000; font-size: 28px; font-weight: 800; padding: 8px 24px; border-radius: 30px; display: inline-block; margin: 15px 0; }
            .instructions { font-size: 14px; color: #333; line-height: 1.5; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">MIAR FOOD</div>
            <div class="subtitle">CARDÁPIO DIGITAL & PEDIDOS</div>
            <div class="table-badge">MESA ${selectedTable.number}</div>
            <br/>
            <img src="${qrDataUrl}" class="qr-img" alt="QR Code Mesa ${selectedTable.number}" />
            <div class="instructions">
              <strong>Aponte a câmera do seu celular</strong><br/>
              para visualizar o cardápio e fazer seu pedido diretamente da mesa.
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // QR Code impresso na mesa pro CLIENTE escanear e abrir o cardápio digital.
  // Corrigido 05/09/2026: apontava pra "/app/mesas" (tela interna do garçom,
  // exige login) com parâmetros que o QR Menu nem lê — cliente nenhum
  // conseguia abrir o cardápio escaneando. Rota certa é "/menu" (app QrMenu
  // na Vercel) com "?qr=<token>", que é o parâmetro que
  // TableSessionContext.tsx (QrMenu) realmente resolve via
  // GET /api/tables/by-token/:token pra achar mesa e empresa certas.
  useEffect(() => {
    if (selectedTable && isQrModalOpen) {
      const url = qrmenuLink(selectedTable.qrToken);
      QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#06100A', light: '#FFFFFF' } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    }
  }, [selectedTable, isQrModalOpen]);

  return (
    <div className="space-y-6 select-none font-inter text-[#F2F7F3]">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#16301F] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-[#008000]/10 text-[#38B000] border border-[#008000]/30 font-manrope">
              <Utensils className="h-3 w-3 text-[#38B000]" /> {t('mesas.operacao_salao')}
            </span>
          </div>
          <h1 className="text-2xl font-manrope font-black text-[#F2F7F3] mt-1 flex items-center gap-2">
            <Table2 className="h-7 w-7 text-[#008000]" /> {t('mesas.titulo')}
          </h1>
          <p className="text-xs text-[#8FA396]">
            {t('mesas.subtitulo')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div>
            <label className="sr-only" htmlFor="mesas-page-size">Mesas por página</label>
            <select
              id="mesas-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as 20 | 50 | 100)}
              className="rounded-xl border border-[#16301F] bg-[#06100A] px-3 py-2.5 text-xs font-bold text-[#F2F7F3] focus:border-[#008000] focus:outline-none cursor-pointer"
              title="Quantas mesas mostrar por vez"
            >
              <option value={20} className="bg-[#06100A]">20 por página</option>
              <option value={50} className="bg-[#06100A]">50 por página</option>
              <option value={100} className="bg-[#06100A]">100 por página</option>
            </select>
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[#008000]/40 bg-[#0B1A10] px-3.5 py-2.5 text-xs font-bold text-[#008000] hover:bg-[#002855] transition-all shadow-md"
          >
            <QrCode className="h-4 w-4" />
            Escanear QR da Mesa
          </button>
          {canManageTables && (
            <button
              onClick={() => setIsNewTableOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#008000] px-4 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] active:scale-95 transition-all shadow-[0_2px_12px_rgba(255,195,0,0.3)]"
            >
              <Plus className="h-4 w-4" />
              {t('mesas.nova_mesa')}
            </button>
          )}
        </div>
      </div>

      {/* Stat Summary Chips — clicáveis: filtram a grade de mesas abaixo
          pelo status correspondente (05/09/2026, pedido explícito: "ao
          clicar mostra real"). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button type="button" onClick={() => goToFilter('all')} className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-3 shadow-lg text-left hover:border-[#008000]/50 transition-colors">
          <div className="text-[10px] font-medium text-[#8FA396]">{t('mesas.stat_total')}</div>
          <div className="text-xl font-manrope font-bold text-[#F2F7F3]">{stats.total}</div>
        </button>
        <button type="button" onClick={() => goToFilter('occupied')} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 shadow-lg text-left hover:border-amber-400 transition-colors">
          <div className="text-[10px] font-medium text-amber-400">{t('mesas.stat_abertas')}</div>
          <div className="text-xl font-manrope font-bold text-amber-300">{stats.occupied}</div>
        </button>
        <button type="button" onClick={() => goToFilter('free')} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-lg text-left hover:border-emerald-400 transition-colors">
          <div className="text-[10px] font-medium text-emerald-400">{t('mesas.stat_livres')}</div>
          <div className="text-xl font-manrope font-bold text-emerald-300">{stats.free}</div>
        </button>
        <button type="button" onClick={() => goToFilter('preparing')} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3 shadow-lg text-left hover:border-orange-400 transition-colors">
          <div className="text-[10px] font-medium text-orange-400">{t('mesas.stat_preparo')}</div>
          <div className="text-xl font-manrope font-bold text-orange-300">{stats.preparing}</div>
        </button>
        <button type="button" onClick={() => goToFilter('ready')} className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 shadow-lg text-left hover:border-sky-400 transition-colors">
          <div className="text-[10px] font-medium text-sky-400">{t('mesas.stat_prontas')}</div>
          <div className="text-xl font-manrope font-bold text-sky-300">{stats.ready}</div>
        </button>
        <button type="button" onClick={() => goToFilter('payment')} className="rounded-2xl border border-[#008000]/40 bg-[#008000]/10 p-3 shadow-lg text-left hover:border-[#008000] transition-colors">
          <div className="text-[10px] font-medium text-[#38B000]">{t('mesas.stat_fechar')}</div>
          <div className="text-xl font-manrope font-bold text-[#38B000]">{stats.payment}</div>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0B1A10] p-2 rounded-2xl border border-[#16301F]">
        <DraggableScroll className="gap-1.5 pb-1 md:pb-0">
          {[
            { id: 'all', label: `${t('mesas.aba_todas')} (${stats.total})` },
            { id: 'occupied', label: `${t('mesas.aba_abertas')} (${stats.occupied})` },
            { id: 'free', label: `${t('mesas.aba_livres')} (${stats.free})` },
            { id: 'ready', label: `${t('mesas.aba_prontas')} (${stats.ready})` },
            { id: 'payment', label: `${t('mesas.aba_fechar_conta')} (${stats.payment})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                filterTab === tab.id
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold shadow-md'
                  : 'text-[#8FA396] hover:bg-[#06100A]/60 hover:text-[#F2F7F3]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </DraggableScroll>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8FA396]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('mesas.buscar_placeholder')}
            className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-1.5 pl-9 pr-3 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none"
          />
        </div>
      </div>

      {/* Estado vazio real — conta nova, ainda sem nenhuma mesa cadastrada
          de verdade no backend (ver correção 05/09/2026 no topo do
          arquivo). Só aparece depois da primeira resposta real do
          GET /tables, pra não piscar antes de saber a verdade. */}
      {hasLoadedOnce && tables.length === 0 && !isCriarMesasOpen && (
        <div className="rounded-2xl border border-dashed border-[#16301F] bg-[#0B1A10] p-8 text-center">
          <Utensils className="h-10 w-10 text-[#008000] mx-auto mb-3" />
          <h3 className="font-manrope font-bold text-base text-[#F2F7F3] mb-1">Você ainda não tem mesas cadastradas</h3>
          <p className="text-xs text-[#8FA396] mb-4">Diga quantas mesas seu estabelecimento tem pra gente criar todas de uma vez.</p>
          <button
            onClick={() => setIsCriarMesasOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#008000] px-5 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] transition"
          >
            <Plus className="h-4 w-4" /> Criar mesas agora
          </button>
        </div>
      )}

      {isCriarMesasOpen && (
        <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 max-w-sm">
          <label className="block text-xs font-bold text-[#8FA396] mb-1">Quantas mesas?</label>
          <input
            type="number"
            min={1}
            max={200}
            value={criarMesasQtd}
            onChange={(e) => setCriarMesasQtd(e.target.value)}
            className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-sm text-[#F2F7F3] focus:border-[#008000] focus:outline-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void criarMesasEmLote()}
              disabled={criandoMesas}
              className="flex-1 rounded-xl bg-[#008000] py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] disabled:opacity-50"
            >
              {criandoMesas ? 'Criando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => setIsCriarMesasOpen(false)}
              disabled={criandoMesas}
              className="rounded-xl border border-[#16301F] px-4 py-2.5 text-xs font-bold text-[#8FA396] hover:text-[#F2F7F3]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tables Grid */}
      <div ref={tablesGridRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {paginatedTables.map((table) => {
          const isFree = table.status === 'free';
          const isReady = table.status === 'ready';
          const isPayment = table.status === 'payment_pending';
          const isPreparing = table.status === 'preparing';
          // "Falta N" real — quantos itens da mesa ainda não foram
          // entregues (pego no balcão pelo garçom). Zero com pelo menos um
          // pedido na mesa = tudo entregue, sinal verde.
          const missingCount = table.orders.filter((o) => o.status !== 'delivered').length;
          const allDelivered = table.orders.length > 0 && missingCount === 0;

          let statusBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
          let statusText = t('mesas.status_livre');
          if (isPreparing) {
            statusBadgeClass = 'bg-orange-500/10 text-orange-400 border-orange-500/30 animate-pulse';
            statusText = t('mesas.status_preparo');
          } else if (isReady) {
            statusBadgeClass = 'bg-sky-500/10 text-sky-300 border-sky-500/50 shadow-[0_0_12px_rgba(56,189,248,0.3)]';
            statusText = t('mesas.status_pronto');
          } else if (isPayment) {
            statusBadgeClass = 'bg-[#008000]/20 text-[#38B000] border-[#008000]/50 shadow-[0_0_12px_rgba(255,195,0,0.3)]';
            statusText = t('mesas.status_pagamento');
          } else if (!isFree) {
            statusBadgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
            statusText = t('mesas.status_ocupada');
          }

          // Pedido do dono do sistema: clicar na mesa abre o modal único
          // (itens, pedidos, adicionar, cancelar, fechar conta) — não só os
          // dois botões de atalho de antes.
          const openTableModal = () => {
            setSelectedTable(table);
            setCalledTables((prev) => {
              if (!prev.has(table.number)) return prev;
              const next = new Set(prev);
              next.delete(table.number);
              return next;
            });
            setIsOrderModalOpen(true);
          };

          return (
            <div
              key={table.id}
              onClick={openTableModal}
              className={`rounded-2xl border bg-[#0B1A10] p-4 flex flex-col justify-between transition-all duration-200 hover:border-[#008000]/40 shadow-xl cursor-pointer ${
                calledTables.has(table.number)
                  ? 'border-rose-500 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                  : isReady ? 'border-sky-500/50' : isPayment ? 'border-[#008000]' : 'border-[#16301F]'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-manrope font-extrabold text-lg text-[#F2F7F3]">
                      {t('mesas.mesa')} {table.number}
                    </h3>
                    <span className="text-[11px] text-[#8FA396] flex items-center gap-1">
                      <Users className="h-3 w-3 text-[#38B000]" /> {table.seats} {t('mesas.lugares')} {table.openedAt ? `• ${t('mesas.aberta_as')} ${table.openedAt}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border ${statusBadgeClass}`}>
                      {isReady && <Bell className="h-3 w-3 animate-bounce" />}
                      {isPreparing && <ChefHat className="h-3 w-3" />}
                      {statusText}
                    </span>
                    {/* "Falta N" real de itens entregues — só faz sentido pra
                        mesa com pedido ativo. */}
                    {table.orders.length > 0 && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                        allDelivered
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {allDelivered ? 'Tudo entregue' : `Falta ${missingCount}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Orders List Preview */}
                {!isFree && table.orders.length > 0 ? (
                  <div className="mt-3 bg-[#06100A] rounded-xl p-2.5 border border-[#16301F] space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    <div className="text-[10px] font-bold text-[#8FA396] uppercase tracking-wider mb-1">
                      {t('mesas.pedidos_na_mesa')} ({table.orders.length}):
                    </div>
                    {table.orders.map((ord) => (
                      <div key={ord.id} className="flex items-center justify-between text-xs text-[#F2F7F3]">
                        <span className="truncate pr-1">
                          <strong className="text-[#38B000]">{ord.qty}x</strong> {ord.name}
                        </span>
                        {/* "Pronto" é clicável — garçom confirma que pegou no
                            balcão e levou pra mesa, vira "entregue". */}
                        <button
                          type="button"
                          disabled={ord.status !== 'ready' || markingDelivered === ord.orderId}
                          onClick={() => ord.status === 'ready' && markDelivered(ord.orderId)}
                          title={ord.status === 'ready' ? 'Marcar como entregue' : undefined}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                            ord.status === 'ready'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 cursor-pointer hover:bg-sky-500/30'
                              : ord.status === 'preparing'
                              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 cursor-default'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 cursor-default'
                          }`}
                        >
                          {markingDelivered === ord.orderId
                            ? '...'
                            : ord.status === 'ready' ? t('mesas.item_pronto') : ord.status === 'preparing' ? t('mesas.item_preparo') : t('mesas.item_entregue')}
                        </button>
                        {/* Cancelar — só faz sentido antes de entregue (depois já foi servido, ver guard no backend). */}
                        {ord.status !== 'delivered' && (
                          <button
                            type="button"
                            disabled={cancellingOrderId === ord.orderId}
                            onClick={() => setPendingCancelOrder({ orderId: ord.orderId, tableNumber: table.number })}
                            title="Cancelar pedido"
                            className="ml-1 shrink-0 rounded border border-red-900/50 bg-red-950/30 p-1 text-red-400 hover:bg-red-600 hover:text-white transition-all"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 bg-[#06100A]/50 rounded-xl p-3 border border-dashed border-[#16301F] text-center text-xs text-[#7A8F7E]">
                    {t('mesas.mesa_livre_vazia')}
                  </div>
                )}
              </div>

              {/* Card Footer & Actions */}
              <div className="mt-4 pt-3 border-t border-[#16301F]">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="text-[#8FA396]">{t('mesas.total_parcial')}</span>
                  <span className="font-manrope font-black text-sm text-[#38B000]">
                    R$ {table.total.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      openTableModal();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#16301F] py-2 text-xs font-bold text-[#F2F7F3] hover:bg-[#16301F]/80 hover:border-[#008000]/50 border border-[#16301F] transition-all"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#38B000]" />
                    {t('mesas.btn_add_pedido')}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFree) {
                        toast.info(`Mesa ${table.number} já está livre.`);
                        return;
                      }
                      setSelectedTable(table);
                      setCalledTables((prev) => {
                        if (!prev.has(table.number)) return prev;
                        const next = new Set(prev);
                        next.delete(table.number);
                        return next;
                      });
                      setIsPaymentModalOpen(true);
                    }}
                    disabled={isFree}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#008000] py-2 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] disabled:opacity-30 disabled:bg-[#16301F] disabled:text-[#8FA396] transition-all shadow-[0_2px_8px_rgba(255,195,0,0.2)]"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {t('mesas.btn_fechar_conta')}
                  </button>
                </div>

                <div className="mt-2 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTable(table);
                      setCalledTables((prev) => {
                        if (!prev.has(table.number)) return prev;
                        const next = new Set(prev);
                        next.delete(table.number);
                        return next;
                      });
                      setIsQrModalOpen(true);
                    }}
                    className="text-[10px] text-[#8FA396] hover:text-[#008000] hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <QrCode className="h-3 w-3" /> {t('mesas.btn_ver_qrcode')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTables.length > pageSize && (
        <p className="text-center text-[11px] text-[#8FA396]">
          Mostrando {paginatedTables.length} de {filteredTables.length} mesas — aumente o "por página" acima pra ver mais.
        </p>
      )}

      {/* MODAL 1: Adicionar Pedido (Com Categorização) */}
      {isOrderModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3 shrink-0">
              <div>
                <h3 className="font-manrope font-extrabold text-lg text-[#F2F7F3] flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-[#38B000]" />
                  Lançar Pedido — Mesa {selectedTable.number}
                </h3>
                <p className="text-xs text-[#8FA396]">Filtre os produtos por categoria e envie para a Cozinha.</p>
              </div>
              <button onClick={() => setIsOrderModalOpen(false)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#F2F7F3]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pedidos já lançados nesta mesa — status, marcar entregue, cancelar.
                Tudo num modal só, junto com o catálogo pra adicionar (pedido do
                dono do sistema: "clicar na mesa abre modal... itens, pedidos,
                botões adicionar cancelar e todo resto"). */}
            {selectedTable.orders.length > 0 && (
              <div className="shrink-0 bg-[#06100A] rounded-xl p-3 border border-[#16301F] space-y-1.5 max-h-40 overflow-y-auto">
                <div className="text-[10px] font-bold text-[#8FA396] uppercase tracking-wider mb-1">
                  Pedidos desta mesa ({selectedTable.orders.length}):
                </div>
                {selectedTable.orders.map((ord) => (
                  <div key={ord.id} className="flex items-center justify-between text-xs text-[#F2F7F3]">
                    <span className="truncate pr-1">
                      <strong className="text-[#38B000]">{ord.qty}x</strong> {ord.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={ord.status !== 'ready' || markingDelivered === ord.orderId}
                        onClick={() => ord.status === 'ready' && markDelivered(ord.orderId)}
                        title={ord.status === 'ready' ? 'Marcar como entregue' : undefined}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          ord.status === 'ready'
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 cursor-pointer hover:bg-sky-500/30'
                            : ord.status === 'preparing'
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 cursor-default'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 cursor-default'
                        }`}
                      >
                        {markingDelivered === ord.orderId
                          ? '...'
                          : ord.status === 'ready' ? t('mesas.item_pronto') : ord.status === 'preparing' ? t('mesas.item_preparo') : t('mesas.item_entregue')}
                      </button>
                      {ord.status !== 'delivered' && (
                        <button
                          type="button"
                          disabled={cancellingOrderId === ord.orderId}
                          onClick={() => setPendingCancelOrder({ orderId: ord.orderId, tableNumber: selectedTable.number })}
                          title="Cancelar pedido"
                          className="rounded border border-red-900/50 bg-red-950/30 p-1 text-red-400 hover:bg-red-600 hover:text-white transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Category Filter Chips & Search Bar */}
            <div className="shrink-0 space-y-2.5">
              <DraggableScroll className="gap-2 pb-1">
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setOrderModalCategory(cat)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all border ${
                      orderModalCategory === cat
                        ? 'bg-[#008000] text-[#F2F7F3] border-[#008000] shadow-md'
                        : 'bg-[#06100A] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </DraggableScroll>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8FA396]" />
                <input
                  type="text"
                  value={orderModalSearch}
                  onChange={(e) => setOrderModalSearch(e.target.value)}
                  placeholder={`Procurar item em ${orderModalCategory}...`}
                  className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2 pl-9 pr-3 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none"
                />
              </div>
            </div>

            {/* Internal Scrollable Menu Items Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
              <div className="text-[11px] font-bold text-[#38B000] uppercase tracking-wider">
                {orderModalCategory} ({filteredOrderMenuItems.length} itens):
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredOrderMenuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="flex items-center justify-between rounded-2xl border border-[#16301F] bg-[#06100A] p-3 cursor-pointer hover:border-[#008000] hover:bg-[#16301F]/40 transition-all group"
                  >
                    <div>
                      <span className="text-[9px] font-bold text-[#38B000] uppercase tracking-widest bg-[#0B1A10] px-2 py-0.5 rounded-md border border-[#16301F]">
                        {item.category}
                      </span>
                      <div className="text-xs font-bold text-[#F2F7F3] mt-1 group-hover:text-[#38B000] transition-colors">
                        {item.name}
                      </div>
                      <div className="text-xs text-[#008000] font-manrope font-black mt-0.5">
                        R$ {item.price.toFixed(2)}
                      </div>
                    </div>
                    <button className="h-8 w-8 rounded-xl bg-[#008000] text-[#F2F7F3] flex items-center justify-center font-black text-sm hover:bg-[#38B000] shrink-0">
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Preview & Final Action Bar */}
            <div className="shrink-0 border-t border-[#16301F] pt-3 space-y-3 bg-[#0B1A10]">
              <div className="text-xs font-bold text-[#F2F7F3] flex items-center justify-between">
                <span>Resumo do Pedido ({orderCart.reduce((a, c) => a + c.qty, 0)} itens):</span>
                <span className="text-[#38B000] font-manrope text-sm font-black">
                  Total: R$ {orderCart.reduce((acc, c) => acc + c.item.price * c.qty, 0).toFixed(2)}
                </span>
              </div>

              {orderCart.length === 0 ? (
                <div className="text-xs text-[#7A8F7E] italic text-center py-3 bg-[#06100A] rounded-xl border border-dashed border-[#16301F]">
                  Clique nos produtos acima para adicionar ao pedido da mesa.
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-h-24">
                  {orderCart.map((c) => (
                    <div key={c.item.id} className="flex items-center gap-2 bg-[#06100A] px-3 py-1.5 rounded-xl border border-[#16301F] text-xs shrink-0">
                      <div>
                        <span className="font-bold text-[#F2F7F3] block text-[11px]">{c.item.name}</span>
                        <span className="text-[10px] text-[#38B000] font-bold">{c.qty}x • R$ {(c.item.price * c.qty).toFixed(2)}</span>
                      </div>
                      <button onClick={() => removeFromCart(c.item.id)} className="text-rose-400 hover:text-rose-300 text-xs pl-1">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                {selectedTable.status !== 'free' && (
                  <button
                    onClick={() => {
                      setIsOrderModalOpen(false);
                      setIsPaymentModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-[#008000]/50 bg-[#06100A] px-4 py-2 text-xs font-bold text-[#38B000] hover:bg-[#008000]/10"
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Fechar Conta
                  </button>
                )}
                <div className="flex items-center justify-end gap-3 ml-auto">
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={submitOrderToKitchen}
                    disabled={orderCart.length === 0 || isSubmittingOrder}
                    className="flex items-center gap-2 rounded-xl bg-[#008000] px-5 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] disabled:opacity-40 shadow-[0_2px_12px_rgba(255,195,0,0.3)] transition-all"
                  >
                    <Send className="h-4 w-4" /> {isSubmittingOrder ? 'Enviando...' : 'Enviar para Cozinha (KDS)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Fechar Conta & Pagamento */}
      {isPaymentModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3">
              <div>
                <h3 className="font-manrope font-bold text-lg text-[#F2F7F3]">
                  Encerrar Conta — Mesa {selectedTable.number}
                </h3>
                <p className="text-xs text-[#8FA396]">Confira os valores e selecione a forma de pagamento.</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#F2F7F3]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Total Box */}
            <div className="bg-[#06100A] rounded-2xl p-4 border border-[#008000]/40 text-center space-y-1">
              <span className="text-xs text-[#8FA396] uppercase tracking-wider font-semibold">Valor Total da Mesa</span>
              <div className="text-3xl font-manrope font-black text-[#38B000]">
                R$ {selectedTable.total.toFixed(2)}
              </div>
              {splitCount > 1 && (
                <div className="text-xs text-emerald-400 font-semibold pt-1">
                  R$ {(selectedTable.total / splitCount).toFixed(2)} por pessoa ({splitCount}x)
                </div>
              )}
            </div>

            {/* Split Account Control */}
            <div>
              <label className="block text-xs font-semibold text-[#8FA396] mb-1">
                Dividir Conta em Quantas Pessoas?
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSplitCount(num)}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all border ${
                      splitCount === num
                        ? 'bg-[#008000] text-[#F2F7F3] border-[#008000]'
                        : 'bg-[#06100A] text-[#8FA396] border-[#16301F] hover:text-[#F2F7F3]'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#8FA396] mb-1">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'pix', label: 'Pix (Instantâneo)' },
                  { id: 'credit', label: 'Cartão de Crédito' },
                  { id: 'debit', label: 'Cartão de Débito' },
                  { id: 'cash', label: 'Dinheiro' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id as any)}
                    className={`rounded-xl py-2.5 px-3 text-xs font-bold text-left transition-all border ${
                      paymentMethod === pm.id
                        ? 'bg-[#16301F] text-[#38B000] border-[#008000]'
                        : 'bg-[#06100A] text-[#8FA396] border-[#16301F] hover:text-[#F2F7F3]'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <button
              onClick={finalizePayment}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#008000] py-3 text-xs font-manrope font-bold text-[#F2F7F3] hover:bg-[#38B000] shadow-[0_2px_12px_rgba(255,195,0,0.3)] transition-all"
            >
              <CheckCircle2 className="h-4 w-4" /> Confirmar Pagamento & Liberar Mesa
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: QR Code da Mesa */}
      {isQrModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl text-center space-y-4 font-inter text-[#F2F7F3] max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3">
              <h3 className="font-manrope font-extrabold text-lg text-[#F2F7F3]">
                QR Code — Mesa {selectedTable.number}
              </h3>
              <button onClick={() => setIsQrModalOpen(false)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#F2F7F3]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Ajuste de Tamanho (Apenas Administrador / Gestor) */}
            <div className="space-y-1.5 text-left">
              <span className="text-[11px] font-bold text-[#8FA396] uppercase tracking-wider block">Ajuste de Dimensão de Impressão:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'sm', label: 'Pequeno (8x8cm)' },
                  { id: 'md', label: 'Médio (12x12cm)' },
                  { id: 'lg', label: 'Display (10x15cm)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setQrSize(s.id as 'sm' | 'md' | 'lg')}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                      qrSize === s.id
                        ? 'bg-[#008000] text-[#F2F7F3] border-[#008000]'
                        : 'bg-[#06100A] text-[#8FA396] border-[#16301F] hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-inner border-2 border-[#008000]/50 text-center">
              <div className="mb-2 inline-block px-3 py-1 rounded-full bg-[#06100A] text-[#008000] font-black text-xs">
                MESA {selectedTable.number}
              </div>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code Mesa ${selectedTable.number}`}
                  className={`transition-all mx-auto ${qrSize === 'sm' ? 'h-40 w-40' : qrSize === 'lg' ? 'h-64 w-64' : 'h-52 w-52'}`}
                />
              ) : (
                <div className="h-52 w-52 flex items-center justify-center text-xs text-[#7A8F7E]">Gerando QR Code...</div>
              )}
            </div>

            <p className="text-xs text-[#8FA396]">
              Contém a identificação da <strong>Mesa {selectedTable.number}</strong>. Ao ser escaneado pelo garçom ou cliente, abre o cardápio e lança pedidos diretamente associados a esta mesa.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsQrModalOpen(false);
                  setIsOrderModalOpen(true);
                  toast.success(`Mesa ${selectedTable.number} selecionada para lançamento de pedidos!`);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#008000]/50 bg-[#008000]/10 py-2.5 text-xs font-bold text-[#38B000] hover:bg-[#008000]/20 transition-all"
              >
                <Utensils className="h-4 w-4" /> Abrir Lançamento de Pedidos (Mesa {selectedTable.number})
              </button>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qrmenuLink(selectedTable.qrToken));
                    toast.success('Link do QR Code da Mesa copiado!');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#16301F] bg-[#06100A] px-3.5 py-2 text-xs font-bold text-[#F2F7F3] hover:border-[#008000]"
                >
                  <Copy className="h-3.5 w-3.5 text-[#38B000]" /> Copiar Link
                </button>

                <button
                  type="button"
                  onClick={exportQrToPdfOrPrint}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#008000] px-4 py-2 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] shadow-[0_2px_12px_rgba(255,195,0,0.3)] transition-all"
                >
                  <Printer className="h-3.5 w-3.5" /> Exportar PDF / Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Criar Nova Mesa */}
      {isNewTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-[#16301F] pb-2">
              <h3 className="font-manrope font-bold text-lg text-[#F2F7F3]">Nova Mesa</h3>
              <button onClick={() => setIsNewTableOpen(false)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#F2F7F3]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#8FA396] mb-1">Número da Mesa</label>
                <input
                  type="number"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="Ex: 9"
                  required
                  className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8FA396] mb-1">Capacidade (Lugares)</label>
                <input
                  type="number"
                  value={newSeats}
                  onChange={(e) => setNewSeats(e.target.value)}
                  placeholder="Ex: 4"
                  required
                  className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#008000] py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000]"
              >
                <Plus className="h-4 w-4" /> Criar Mesa & Gerar QR
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Scanner de QR Code do Garçom */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl space-y-4 font-inter text-[#F2F7F3] max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#008000]" />
                <h3 className="font-manrope font-bold text-lg text-[#F2F7F3]">Escanear QR da Mesa</h3>
              </div>
              <button onClick={() => setIsScannerOpen(false)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#F2F7F3]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-[#008000]/40 bg-[#06100A] p-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#008000]/10 flex items-center justify-center text-[#008000]">
                <QrCode className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#F2F7F3]">Leitor de QR Code Ativo</p>
                <p className="text-[11px] text-[#8FA396] mt-1">
                  Aponte a câmera do dispositivo do garçom para a etiqueta da mesa ou toque numa mesa abaixo.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[#8FA396] uppercase tracking-wider block">Seleção Rápida de Mesa:</span>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTable(t);
                      setIsScannerOpen(false);
                      setIsOrderModalOpen(true);
                      toast.success(`📍 Mesa ${t.number} selecionada! Lançando pedido.`);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 ${
                      t.status === 'free'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                    }`}
                  >
                    <span className="text-[10px] font-medium text-[#8FA396]">MESA</span>
                    <span className="text-lg font-black text-[#F2F7F3]">{t.number}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsScannerOpen(false)}
              className="w-full py-2.5 rounded-xl border border-[#16301F] bg-[#06100A] text-xs font-bold text-[#8FA396] hover:text-white"
            >
              Fechar Scanner
            </button>
          </div>
        </div>
      )}

      {/* Confirmação de cancelamento — modal próprio do sistema, não window.confirm() nativo. */}
      {pendingCancelOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4"
          onClick={() => setPendingCancelOrder(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-red-900/50 bg-[#0B1A10] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-400 font-manrope font-bold text-base">
              <AlertTriangle className="h-5 w-5" />
              Cancelar pedido?
            </div>
            <p className="mt-2 text-sm text-[#8FA396]">
              Mesa {pendingCancelOrder.tableNumber} — essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingCancelOrder(null)}
                className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  const { orderId, tableNumber } = pendingCancelOrder;
                  setPendingCancelOrder(null);
                  cancelOrderAsWaiter(orderId, tableNumber);
                }}
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
