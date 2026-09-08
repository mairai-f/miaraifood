import { useEffect, useMemo, useRef, useState } from 'react';

type OrderStatus = 'received' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'completed' | 'cancelled';

type CartItem = {
  id: string;
  name: string;
  kind: 'pizza' | 'churrasco';
  price: number;
  customization: Record<string, unknown>;
};

type WorkflowOrder = {
  id: string;
  restaurantName: string;
  customerName: string;
  mode: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  kind?: 'pizza' | 'churrasco' | 'generic';
  customization?: Record<string, unknown>;
  address?: string;
  phone?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
};

export interface CatalogItem {
  id: string;
  name: string;
  category: 'lanches' | 'pizzas' | 'churrasco' | 'porcoes' | 'bebidas' | 'sobremesas';
  kind: 'pizza' | 'churrasco' | 'generic';
  price: number;
  description: string;
  prepMinutes: number;
  customization?: Record<string, unknown>;
}

export const catalog: CatalogItem[] = [
  // Hambúrgueres & Lanches
  {
    id: 'xtudo-artesanal',
    name: 'X-Tudo Artesanal Supreme',
    category: 'lanches',
    kind: 'generic',
    price: 34.90,
    prepMinutes: 15,
    description: 'Hambúrguer de fraldinha 180g, bacon crocante, queijo prato, ovo, alface, tomate e maionese da casa.',
  },
  {
    id: 'smash-burger',
    name: 'Smash Burger Duplo Cheddar',
    category: 'lanches',
    kind: 'generic',
    price: 29.90,
    prepMinutes: 12,
    description: 'Dois smashes de 90g com crosta perfeita, cheddar inglês derretido e cebola caramelizada.',
  },
  {
    id: 'xsalada-especial',
    name: 'X-Salada Especial MIAR',
    category: 'lanches',
    kind: 'generic',
    price: 26.00,
    prepMinutes: 10,
    description: 'Hambúrguer 160g, queijo mussarela, alface americana, tomate fresco e maionese verde artesanal.',
  },

  // Pizzas
  {
    id: 'pizza-marguerita',
    name: 'Pizza Marguerita Especial',
    category: 'pizzas',
    kind: 'pizza',
    price: 49.00,
    prepMinutes: 20,
    description: 'Molho de tomate italiano, mussarela especial, rodelas de tomate e manjericão fresco.',
    customization: { size: 'Média', flavor: 'Marguerita', split: 'full', edge: 'normal' },
  },
  {
    id: 'pizza-calabresa',
    name: 'Pizza Calabresa com Catupiry',
    category: 'pizzas',
    kind: 'pizza',
    price: 55.00,
    prepMinutes: 22,
    description: 'Calabresa artesanal fatiada, cebola roxa, azeitonas pretas e borda recheada com Catupiry.',
    customization: { size: 'Grande', flavor: 'Calabresa', split: 'full', edge: 'recheada' },
  },
  {
    id: 'pizza-quatro-queijos',
    name: 'Pizza 4 Queijos Supreme',
    category: 'pizzas',
    kind: 'pizza',
    price: 59.00,
    prepMinutes: 25,
    description: 'Mussarela, gorgonzola, provolone e requeijão cremoso gratinado no forno a lenha.',
    customization: { size: 'Grande', flavor: '4 Queijos', split: 'full', edge: 'recheada' },
  },

  // Churrasco & Pratos
  {
    id: 'churrasco-picanha',
    name: 'Picanha Premium na Chapa 500g',
    category: 'churrasco',
    kind: 'churrasco',
    price: 89.00,
    prepMinutes: 25,
    description: 'Corte nobre servido na chapa quente, acompanhado de arroz biro-biro, farofa e vinagrete.',
    customization: { cut: 'Picanha', weight: 500, doneness: 'ao ponto', sides: ['arroz', 'farofa', 'vinagrete'] },
  },
  {
    id: 'ancho-grelhado',
    name: 'Bife Ancho Angus 400g',
    category: 'churrasco',
    kind: 'churrasco',
    price: 78.00,
    prepMinutes: 22,
    description: 'Bife ancho grelhado no fogo forte com manteiga de ervas e mandioca frita crocante.',
    customization: { cut: 'Ancho', weight: 400, doneness: 'ao ponto', sides: ['mandioca', 'farofa'] },
  },

  // Porções & Acompanhamentos
  {
    id: 'batata-rustica',
    name: 'Batata Rústica Cheddar & Bacon',
    category: 'porcoes',
    kind: 'generic',
    price: 38.00,
    prepMinutes: 12,
    description: 'Batatas temperadas com páprica e alecrim, cobertas com cheddar cremoso e bacon em cubos.',
  },
  {
    id: 'aneis-cebola',
    name: 'Onion Rings Crocantes',
    category: 'porcoes',
    kind: 'generic',
    price: 28.00,
    prepMinutes: 10,
    description: 'Anéis de cebola empanados na farinha panko com molho barbecue artesanal.',
  },

  // Bebidas & Sucos
  {
    id: 'coca-zero-350',
    name: 'Coca-Cola Zero 350ml (Lata)',
    category: 'bebidas',
    kind: 'generic',
    price: 7.50,
    prepMinutes: 3,
    description: 'Geladíssima com fatia de limão opcional.',
  },
  {
    id: 'guarana-2l',
    name: 'Guaraná Antarctica 2L',
    category: 'bebidas',
    kind: 'generic',
    price: 14.00,
    prepMinutes: 3,
    description: 'Garrafa 2 Litros bem gelada.',
  },
  {
    id: 'suco-laranja',
    name: 'Suco de Laranja Natural 500ml',
    category: 'bebidas',
    kind: 'generic',
    price: 12.00,
    prepMinutes: 5,
    description: 'Espremido na hora, 100% fruta natural sem adição de açúcar.',
  },
  {
    id: 'chopp-pilsen',
    name: 'Chopp Pilsen Artesanal 500ml',
    category: 'bebidas',
    kind: 'generic',
    price: 14.90,
    prepMinutes: 3,
    description: 'Caneca trincando de gelada com colarinho cremoso.',
  },

  // Sobremesas
  {
    id: 'petit-gateau',
    name: 'Petit Gâteau com Sorvete',
    category: 'sobremesas',
    kind: 'generic',
    price: 24.00,
    prepMinutes: 8,
    description: 'Bolo quente de chocolate com recheio cremoso e sorvete de creme artesanal.',
  },
  {
    id: 'pudim-leite',
    name: 'Pudim de Leite Condensado',
    category: 'sobremesas',
    kind: 'generic',
    price: 14.00,
    prepMinutes: 4,
    description: 'Receita tradicional com calda de caramelo bem lisinho.',
  },
];

function formatStatus(status: OrderStatus) {
  switch (status) {
    case 'received': return 'Recebido';
    case 'confirmed': return 'Confirmado';
    case 'preparing': return 'Em preparo';
    case 'ready': return 'Pronto / Servido';
    case 'delivering': return 'Em rota';
    case 'completed': return 'Finalizado';
    default: return 'Cancelado';
  }
}

export type CustomerCartItem = {
  cartId: string;
  catalogId: string;
  name: string;
  category: string;
  kind: 'pizza' | 'churrasco' | 'generic';
  price: number;
  prepMinutes: number;
  quantity: number;
  notes: string;
};

export function ClientExperience() {
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [cart, setCart] = useState<CustomerCartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [sendingOrder, setSendingOrder] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState('');
  const [activeOrder, setActiveOrder] = useState<{
    id: string;
    tableNumber: string | number;
    total: number;
    estimatedMinutes: number;
    createdAt: Date;
    items: { name: string; quantity: number; notes?: string }[];
  } | null>(null);

  // Auto-detect mesa URL query param (e.g. ?mesa=4)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mesa = params.get('mesa');
      if (mesa) {
        setTableNumber(mesa);
        setCustomerName((prev) => prev || `Mesa ${mesa}`);
      }
    }
  }, []);

  // Cálculo Dinâmico de Tempo de Espera Estimado
  const estimatedWaitMinutes = useMemo(() => {
    if (cart.length === 0) return 0;
    const maxItemTime = Math.max(...cart.map((item) => item.prepMinutes));
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
    const qtyModifier = Math.floor((totalQty - 1) / 2) * 2;
    return maxItemTime + qtyModifier;
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (catalogItem: CatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.catalogId === catalogItem.id && i.notes === '');
      if (existing) {
        return prev.map((i) => (i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          cartId: `${catalogItem.id}-${Date.now()}`,
          catalogId: catalogItem.id,
          name: catalogItem.name,
          category: catalogItem.category,
          kind: catalogItem.kind,
          price: catalogItem.price,
          prepMinutes: catalogItem.prepMinutes,
          quantity: 1,
          notes: '',
        },
      ];
    });
    toast.success(`➕ ${catalogItem.name} adicionado!`);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId === cartId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CustomerCartItem[]
    );
  };

  const updateNotes = (cartId: string, notes: string) => {
    setCart((prev) => prev.map((item) => (item.cartId === cartId ? { ...item, notes } : item)));
  };

  const checkout = async () => {
    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho antes de enviar.');
      return;
    }

    setSendingOrder(true);
    setOrderSuccessMessage('');

    try {
      const finalCustomerName = customerName.trim() || (tableNumber ? `Cliente Mesa ${tableNumber}` : 'Cliente Balcão');
      const orderId = `ORD-MESA-${tableNumber || 'BALCAO'}-${Date.now().toString().slice(-4)}`;

      // 1. Injetar Pedido no KDS da Cozinha (localStorage 'miar-kitchen-orders')
      const newKitchenTicket: KitchenTicket = {
        id: orderId,
        tableNumber: tableNumber ? Number(tableNumber) : 'Mesa Digital',
        customerName: `${finalCustomerName} ${tableNumber ? `(Mesa ${tableNumber})` : ''}`,
        origin: tableNumber ? 'Garçom / Mesa' : 'Balcão / Caixa',
        createdAt: new Date().toISOString(),
        status: 'received',
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          notes: item.notes ? item.notes : undefined,
        })),
      };

      const existingOrdersRaw = localStorage.getItem('miar-kitchen-orders');
      let existingOrders: KitchenTicket[] = [];
      try {
        if (existingOrdersRaw) existingOrders = JSON.parse(existingOrdersRaw);
      } catch {
        existingOrders = [];
      }
      const updatedOrders = [newKitchenTicket, ...existingOrders];
      localStorage.setItem('miar-kitchen-orders', JSON.stringify(updatedOrders));

      // Disparar som de alarme na cozinha se disponível
      playKitchenAlarmSound();

      // 2. Atualizar estado da Mesa se tableNumber existir
      if (tableNumber) {
        try {
          const storedMesas = localStorage.getItem('miar-mesas-state');
          if (storedMesas) {
            const mesas = JSON.parse(storedMesas);
            const num = Number(tableNumber);
            const updatedMesas = mesas.map((m: any) => {
              if (m.number === num) {
                return {
                  ...m,
                  status: 'occupied',
                  total: (m.total || 0) + cartTotal,
                  orders: [
                    ...(m.orders || []),
                    {
                      id: orderId,
                      items: cart.map((c) => `${c.quantity}x ${c.name}`),
                      total: cartTotal,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ],
                };
              }
              return m;
            });
            localStorage.setItem('miar-mesas-state', JSON.stringify(updatedMesas));
          }
        } catch {}
      }

      // 3. Tentar API externa se disponível
      try {
        await fetch('/api/operational-workflow/orders/generic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantName: 'MIAR Food',
            customerName: finalCustomerName,
            mode: 'dine-in',
            tableNumber,
            estimatedMinutes: estimatedWaitMinutes,
            total: cartTotal,
            items: cart,
          }),
        });
      } catch {}

      // Configurar Pedido Ativo para o Cliente Acompanhar
      setActiveOrder({
        id: orderId,
        tableNumber: tableNumber || 'Mesa Digital',
        total: cartTotal,
        estimatedMinutes: estimatedWaitMinutes,
        createdAt: new Date(),
        items: cart.map((c) => ({ name: c.name, quantity: c.quantity, notes: c.notes })),
      });

      setCart([]);
      setOrderSuccessMessage(`🎉 Pedido enviado com sucesso para a cozinha!`);
      toast.success(`🍳 Pedido enviado direto para a cozinha!`, {
        description: `Mesa ${tableNumber || 'Balcão'} · Tempo estimado: ~${estimatedWaitMinutes} min`,
        duration: 7000,
      });
    } catch (error) {
      toast.error('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setSendingOrder(false);
    }
  };

  const categoriesList = [
    { id: 'todos', label: 'Todos' },
    { id: 'lanches', label: '🍔 Lanches' },
    { id: 'pizzas', label: '🍕 Pizzas' },
    { id: 'churrasco', label: '🍖 Churrasco' },
    { id: 'porcoes', label: '🍟 Porções' },
    { id: 'bebidas', label: '🥤 Bebidas' },
    { id: 'sobremesas', label: '🍨 Sobremesas' },
  ];

  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'todos') return catalog;
    return catalog.filter((i) => i.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-[#06100A] text-[#F2F7F3] p-4 md:p-6 font-inter max-w-6xl mx-auto">
      {/* Top Banner: Indicação de Mesa escaneada por QR Code */}
      <div className="mb-6 rounded-3xl border border-[#008000]/40 bg-gradient-to-r from-[#0B1A10] via-[#06100A] to-[#0B1A10] p-5 shadow-[0_4px_20px_rgba(255,195,0,0.15)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#38B000]">
              Cardápio Digital & Pedido Direto
            </span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-manrope font-black text-[#F2F7F3]">
            {tableNumber ? `📍 Atendimento na Mesa ${tableNumber}` : '🍽️ Atendimento Digital MIAR'}
          </h1>
          <p className="mt-1 text-xs text-[#8FA396]">
            Seu pedido é enviado direto para a cozinha e pro caixa, identificando sua mesa e calculando o tempo exato de preparo.
          </p>
        </div>

        {tableNumber && (
          <div className="rounded-2xl border border-[#008000] bg-[#008000]/10 px-5 py-3 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#38B000]">Identificação</p>
            <p className="text-xl font-black text-[#F2F7F3]">MESA {tableNumber}</p>
          </div>
        )}
      </div>

      {/* Se houver um pedido ativo já enviado, exibe a tela de Acompanhamento */}
      {activeOrder && (
        <div className="mb-8 rounded-3xl border border-emerald-500/50 bg-[#0B1A10]/90 p-6 shadow-xl animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#16301F] pb-4 mb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/40">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Pedido Confirmado & Na Fila da Cozinha
              </span>
              <h3 className="mt-2 text-xl font-bold text-[#F2F7F3]">Acompanhamento em Tempo Real</h3>
              <p className="text-xs text-[#8FA396]">Senha / Código: {activeOrder.id}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#8FA396]">Tempo Estimado de Espera</p>
              <p className="text-2xl font-black text-[#38B000]">~{activeOrder.estimatedMinutes} min</p>
            </div>
          </div>

          {/* Timeline de Status */}
          <div className="grid grid-cols-3 gap-2 my-4 text-center">
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/50">
              <p className="text-xs font-bold text-emerald-400">1. Recebido ✅</p>
              <p className="text-[10px] text-[#8FA396]">Cozinha notificada</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#008000]/20 border border-[#008000]/50 animate-pulse">
              <p className="text-xs font-bold text-[#38B000]">2. Em Preparo 🍳</p>
              <p className="text-[10px] text-[#8FA396]">Na chapa / Forno</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#06100A] border border-[#16301F] opacity-60">
              <p className="text-xs font-bold text-[#8FA396]">3. Pronto na Mesa 🍽️</p>
              <p className="text-[10px] text-[#8FA396]">Garçom trazendo</p>
            </div>
          </div>

          {/* Resumo dos Itens do Pedido */}
          <div className="rounded-2xl border border-[#16301F] bg-[#06100A] p-4 my-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#38B000] mb-2">Itens Solicitados:</p>
            <div className="space-y-1.5 text-xs text-[#F2F7F3]">
              {activeOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between border-b border-[#16301F]/40 pb-1">
                  <span>{it.quantity}x {it.name} {it.notes ? `(${it.notes})` : ''}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between font-bold text-sm text-[#F2F7F3]">
              <span>Total do Pedido:</span>
              <span className="text-emerald-400">R$ {activeOrder.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setActiveOrder(null)}
              className="flex-1 rounded-xl bg-[#008000] py-3 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] transition"
            >
              ➕ Fazer Novo Pedido
            </button>
            <button
              onClick={() => toast.info(`🔔 Garçom chamado para a Mesa ${tableNumber || 'sua mesa'}!`)}
              className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-3 text-xs font-bold text-[#F2F7F3] hover:border-[#008000] transition"
            >
              🙋‍♂️ Chamar Garçom
            </button>
          </div>
        </div>
      )}

      {/* Grid Principal: Cardápio + Carrinho */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Lado Esquerdo: Cardápio Categorizado */}
        <div className="space-y-4">
          {/* Categorias Filtro */}
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
            {categoriesList.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#008000] text-[#F2F7F3] shadow-[0_0_12px_rgba(255,195,0,0.3)]'
                    : 'border border-[#16301F] bg-[#0B1A10] text-[#8FA396] hover:text-[#F2F7F3]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Lista de Produtos */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            {filteredCatalog.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-[#16301F] bg-[#06100A] p-4 hover:border-[#008000]/60 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-[#F2F7F3] group-hover:text-[#38B000] transition-colors">
                      {item.name}
                    </h3>
                    <span className="shrink-0 rounded-xl bg-[#0B1A10] px-2.5 py-1 text-xs font-black text-emerald-400 border border-[#16301F]">
                      R$ {item.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#8FA396] leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#16301F]/60 pt-3">
                  <span className="text-[10px] font-semibold text-[#38B000] flex items-center gap-1">
                    ⏱️ Preparo: ~{item.prepMinutes} min
                  </span>
                  <button
                    onClick={() => addToCart(item)}
                    className="rounded-xl bg-[#008000] px-3.5 py-1.5 text-xs font-extrabold text-[#F2F7F3] hover:bg-[#38B000] active:scale-95 transition-all shadow-[0_2px_8px_rgba(255,195,0,0.25)]"
                  >
                    + Adicionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lado Direito: Carrinho e Checkout */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#16301F] bg-[#0B1A10]/80 p-5 backdrop-blur-md sticky top-4">
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3 mb-4">
              <div>
                <h3 className="font-manrope font-bold text-lg text-[#F2F7F3]">Meu Pedido</h3>
                <p className="text-xs text-[#8FA396]">
                  {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'} no carrinho
                </p>
              </div>

              {tableNumber && (
                <span className="rounded-full bg-[#008000]/20 border border-[#008000]/40 px-3 py-1 text-xs font-bold text-[#38B000]">
                  Mesa {tableNumber}
                </span>
              )}
            </div>

            {/* Identificação do Cliente */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-[#8FA396] mb-1">
                Nome do Cliente / Identificação na Mesa:
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={tableNumber ? `Mesa ${tableNumber}` : 'Seu nome'}
                className="w-full rounded-xl border border-[#16301F] bg-[#06100A] px-3.5 py-2 text-xs text-[#F2F7F3] outline-none focus:border-[#008000]"
              />
            </div>

            {/* Lista de Itens no Carrinho */}
            <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1 mb-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#7A8F7E]">
                  <p className="text-2xl mb-1">🛒</p>
                  Seu carrinho está vazio. Selecione itens do cardápio acima para fazer seu pedido.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.cartId} className="rounded-2xl border border-[#16301F] bg-[#06100A] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#F2F7F3]">{item.name}</span>
                      <span className="text-xs font-bold text-emerald-400">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Observações / Notas */}
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateNotes(item.cartId, e.target.value)}
                        placeholder="Observações (ex: sem cebola)"
                        className="w-36 rounded-lg border border-[#16301F] bg-[#0B1A10] px-2 py-1 text-[10px] text-[#F2F7F3] outline-none focus:border-[#008000]"
                      />

                      {/* Controles de Quantidade */}
                      <div className="flex items-center gap-2 rounded-xl border border-[#16301F] bg-[#0B1A10] px-2 py-1">
                        <button
                          onClick={() => updateQuantity(item.cartId, -1)}
                          className="text-xs font-bold text-[#38B000] hover:text-white px-1"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-[#F2F7F3]">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartId, 1)}
                          className="text-xs font-bold text-[#38B000] hover:text-white px-1"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Painel de Estimativa Dinâmica de Espera & Total */}
            {cart.length > 0 && (
              <div className="space-y-3 border-t border-[#16301F] pt-4">
                {/* Tempo Estimado Calculado */}
                <div className="rounded-2xl border border-[#008000]/40 bg-[#008000]/10 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏱️</span>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#38B000]">
                        Tempo Estimado de Espera
                      </p>
                      <p className="text-xs font-bold text-[#F2F7F3]">
                        ~{estimatedWaitMinutes} minutos
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#8FA396] text-right max-w-[100px]">
                    Calculado pelo conteúdo dos itens
                  </span>
                </div>

                {/* Subtotal e Total */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8FA396]">Total do Pedido:</span>
                  <span className="text-2xl font-black text-emerald-400">R$ {cartTotal.toFixed(2)}</span>
                </div>

                {/* Botão de Envio para a Cozinha */}
                <button
                  onClick={() => void checkout()}
                  disabled={sendingOrder}
                  className="w-full rounded-2xl bg-[#008000] py-3.5 text-xs font-extrabold text-[#F2F7F3] hover:bg-[#38B000] active:scale-98 transition-all disabled:opacity-50 shadow-[0_4px_15px_rgba(255,195,0,0.3)] flex items-center justify-center gap-2"
                >
                  {sendingOrder ? (
                    'Enviando para a Cozinha...'
                  ) : (
                    <>
                      <span>🍳 Confirmar & Enviar para Cozinha</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { playKitchenAlarmSound } from '../lib/audio-alert';
import { toast } from 'sonner';
import { ChefHat, Clock, CheckCircle2, AlertCircle, Utensils, Bike, ShoppingBag } from 'lucide-react';

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  notes?: string;
}

export interface KitchenTicket {
  id: string;
  tableNumber?: number | string;
  customerName: string;
  origin: 'Garçom / Mesa' | 'Delivery' | 'Balcão / Caixa';
  createdAt: string;
  startedPreparingAt?: string;
  completedAt?: string;
  status: 'received' | 'preparing' | 'completed';
  items: KitchenTicketItem[];
}

const DEFAULT_KITCHEN_TICKETS: KitchenTicket[] = [];

export function KitchenView() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [showOnlyLate, setShowOnlyLate] = useState(false);
  const prevCountRef = useRef<number>(0);

  const loadTickets = () => {
    try {
      const stored = localStorage.getItem('miar-kitchen-orders');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filtra e purga definitivamente qualquer dado fictício legado (ord-101, ord-102, ord-103, Ana Souza, etc)
          const validRealTickets = parsed.filter(
            (t: KitchenTicket) =>
              !t.id.startsWith('ord-10') &&
              !t.customerName?.includes('Ana Souza') &&
              !t.customerName?.includes('Garçom Marcos') &&
              !t.customerName?.includes('Garçom Bruno')
          );

          if (validRealTickets.length !== parsed.length) {
            localStorage.setItem('miar-kitchen-orders', JSON.stringify(validRealTickets));
          }

          if (validRealTickets.length > prevCountRef.current && prevCountRef.current > 0) {
            playKitchenAlarmSound();
            toast.info('🔔 NOVO PEDIDO CHEGOU NA COZINHA!');
          }
          prevCountRef.current = validRealTickets.length;
          setTickets(validRealTickets);
          return;
        }
      }
      localStorage.setItem('miar-kitchen-orders', JSON.stringify([]));
      prevCountRef.current = 0;
      setTickets([]);
    } catch {
      setTickets([]);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(() => {
      loadTickets();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Ordenação ESTRITA por horário de chegada (antigo -> novo: 18:00, 18:10, 18:15)
  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [tickets]);

  const getElapsedTime = (createdAt: string) => {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    return diff;
  };

  const lateTicketsCount = useMemo(() => {
    return tickets.filter((t) => t.status !== 'completed' && getElapsedTime(t.createdAt) > 15).length;
  }, [tickets]);

  const displayedTickets = useMemo(() => {
    if (!showOnlyLate) return sortedTickets;
    return sortedTickets.filter((t) => t.status !== 'completed' && getElapsedTime(t.createdAt) > 15);
  }, [sortedTickets, showOnlyLate]);

  const saveTickets = (updated: KitchenTicket[]) => {
    setTickets(updated);
    localStorage.setItem('miar-kitchen-orders', JSON.stringify(updated));
  };

  const setStatus = (id: string, newStatus: 'preparing' | 'completed') => {
    const now = new Date().toISOString();
    const targetTicket = tickets.find((t) => t.id === id);

    const updated = tickets.map((t) => {
      if (t.id === id) {
        return {
          ...t,
          status: newStatus,
          startedPreparingAt: newStatus === 'preparing' ? (t.startedPreparingAt || now) : t.startedPreparingAt,
          completedAt: newStatus === 'completed' ? now : t.completedAt,
        };
      }
      return t;
    });

    saveTickets(updated);

    if (newStatus === 'completed' && targetTicket) {
      playKitchenAlarmSound();
      const createdTime = new Date(targetTicket.createdAt).getTime();
      const prepStartTime = targetTicket.startedPreparingAt ? new Date(targetTicket.startedPreparingAt).getTime() : createdTime;
      const totalMinutes = Math.max(1, Math.round((Date.now() - createdTime) / 60000));
      const prepMinutes = Math.max(1, Math.round((Date.now() - prepStartTime) / 60000));

      const mesaLabel = targetTicket.tableNumber ? `MESA ${targetTicket.tableNumber}` : targetTicket.customerName;

      const waiterAlerts = JSON.parse(localStorage.getItem('miar-waiter-alerts') || '[]');
      const newAlert = {
        id: `alert-${Date.now()}`,
        mesa: mesaLabel,
        prepMinutes,
        totalMinutes,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      localStorage.setItem('miar-waiter-alerts', JSON.stringify([newAlert, ...waiterAlerts]));

      toast.success(`🔔 ${mesaLabel} PRONTA! Alarme disparado no celular do garçom.`, {
        description: `Tempo Total: ${totalMinutes} min | Tempo de Preparo: ${prepMinutes} min`,
        duration: 8000,
      });
    }
  };

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] bg-[#06100A] text-[#F2F7F3] p-4 md:p-6 flex flex-col font-inter overflow-hidden">
      {/* Header da Cozinha KDS */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 border-b border-[#16301F] pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-[#008000]" />
            <h1 className="text-xl md:text-2xl font-manrope font-extrabold text-[#F2F7F3]">
              Monitor de Preparo KDS — Cozinha
            </h1>
          </div>
          <p className="text-xs text-[#8FA396] mt-1">
            Fila sequencial por horário de chegada (sem dados financeiros). Notificações automáticas sincronizadas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowOnlyLate(!showOnlyLate)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all flex items-center gap-2 ${
              showOnlyLate
                ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.5)]'
                : lateTicketsCount > 0
                ? 'bg-rose-950/60 text-rose-300 border-rose-500/50 hover:bg-rose-900/80 animate-pulse'
                : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:text-white'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            {showOnlyLate ? 'Exibindo Apenas Atrasados' : `Somente Atrasados (${lateTicketsCount})`}
          </button>
          <span className="rounded-xl border border-[#16301F] bg-[#0B1A10] px-3 py-1.5 text-xs font-bold text-[#38B000] flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Fila Ativa: {tickets.filter((t) => t.status !== 'completed').length} pedidos
          </span>
        </div>
      </div>

      {/* Grid de Pedidos com Rolagem Interna */}
      <div className="flex-1 overflow-y-auto min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6 pr-1">
        {displayedTickets.map((t) => {
          const elapsedMinutes = getElapsedTime(t.createdAt);
          const arrivalTime = new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isLate = elapsedMinutes > 15;
          const isWarning = elapsedMinutes >= 10 && elapsedMinutes <= 15;

          return (
            <div
              key={t.id}
              className={`rounded-2xl border flex flex-col justify-between p-4 transition-all shadow-lg ${
                isLate && t.status !== 'completed'
                  ? 'border-rose-500 bg-rose-950/50 ring-2 ring-rose-500 animate-pulse shadow-[0_0_25px_rgba(244,63,94,0.4)]'
                  : t.status === 'completed'
                  ? 'border-emerald-500/40 bg-emerald-950/20 opacity-70'
                  : t.status === 'preparing'
                  ? 'border-[#008000] bg-[#0B1A10]/90 ring-1 ring-[#008000]/40'
                  : 'border-[#16301F] bg-[#06100A]'
              }`}
            >
              <div>
                {/* Header da Comanda */}
                <div className="flex items-center justify-between border-b border-[#16301F]/80 pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold tracking-wider uppercase bg-[#0B1A10] text-[#38B000] px-2 py-0.5 rounded border border-[#16301F]">
                        {t.id}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-[#8FA396] bg-[#06100A] px-1.5 py-0.5 rounded border border-[#16301F]/60">
                        🕒 {arrivalTime}
                      </span>
                    </div>
                    <h3 className="text-base font-manrope font-extrabold text-[#F2F7F3] mt-1.5 flex items-center gap-1.5">
                      {t.origin === 'Delivery' ? (
                        <Bike className="h-4 w-4 text-[#008000]" />
                      ) : t.origin === 'Balcão / Caixa' ? (
                        <ShoppingBag className="h-4 w-4 text-cyan-400" />
                      ) : (
                        <Utensils className="h-4 w-4 text-emerald-400" />
                      )}
                      {t.customerName}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
                        isLate
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                          : isWarning
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {elapsedMinutes} min
                    </span>
                  </div>
                </div>

                {/* Origem e Status Badges */}
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="text-[#8FA396] font-semibold">{t.origin}</span>
                  <span
                    className={`font-extrabold px-2 py-0.5 rounded text-[10px] uppercase ${
                      t.status === 'completed'
                        ? 'bg-emerald-500 text-black'
                        : t.status === 'preparing'
                        ? 'bg-[#008000] text-black animate-pulse'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {t.status === 'completed' ? 'Concluído' : t.status === 'preparing' ? 'Em Preparo' : 'Recebido'}
                  </span>
                </div>

                {/* Lista de Itens */}
                <div className="space-y-2 mb-4 bg-[#0B1A10]/50 p-3 rounded-xl border border-[#16301F]/60">
                  <div className="text-[10px] font-bold text-[#8FA396] uppercase tracking-wider mb-1">
                    Itens do Pedido ({t.items.reduce((acc, i) => acc + i.quantity, 0)}):
                  </div>
                  {t.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col border-b border-[#16301F]/30 last:border-0 pb-1.5 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-extrabold text-[#F2F7F3]">
                          <span className="text-[#008000] font-black mr-1.5">{item.quantity}x</span>
                          {item.name}
                        </span>
                      </div>
                      {item.notes && (
                        <div className="text-xs text-[#38B000] font-semibold mt-0.5 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                          ⚠️ Obs: {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações de Transição de Status */}
              <div className="pt-2 border-t border-[#16301F]/60">
                {t.status === 'received' && (
                  <button
                    type="button"
                    onClick={() => setStatus(t.id, 'preparing')}
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-2.5 text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Clock className="h-4 w-4" />
                    ▶ Iniciar Preparo
                  </button>
                )}

                {t.status === 'preparing' && (
                  <button
                    type="button"
                    onClick={() => setStatus(t.id, 'completed')}
                    className="w-full rounded-xl bg-[#008000] hover:bg-[#38B000] text-[#F2F7F3] font-black py-2.5 text-xs flex items-center justify-center gap-2 transition shadow-md"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    ✓ Concluir Pedido & Disparar Alarme
                  </button>
                )}

                {t.status === 'completed' && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-400 bg-emerald-950/50 rounded-xl border border-emerald-500/40">
                    <CheckCircle2 className="h-4 w-4" />
                    Pronto — Alarme Enviado ao Garçom
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export function CashierView() {
  const [orders, setOrders] = useState<WorkflowOrder[]>([]);

  const load = async () => {
    const response = await fetch('/api/operational-workflow/orders');
    if (response.ok) {
      const data = await response.json();
      setOrders(data);
    }
  };

  useEffect(() => { void load(); }, []);

  const advance = async (order: WorkflowOrder) => {
    await fetch(`/api/operational-workflow/orders/${order.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'cashier' }),
    });
    await load();
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Caixa / Atendente</p>
      <h2 className="mt-2 text-2xl font-semibold">Pedidos para atendimento</h2>
      <div className="mt-4 space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{order.customerName} • {order.mode}</p>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs uppercase">{formatStatus(order.status)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">Total: R$ {order.total.toFixed(2)}</p>
            <button className="mt-3 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => void advance(order)}>Atualizar status</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeliveryView() {
  const [orders, setOrders] = useState<WorkflowOrder[]>([]);
  const [deliveryToken, setDeliveryToken] = useState('');
  const [loginMessage, setLoginMessage] = useState('');

  const load = async () => {
    const response = await fetch('/api/operational-workflow/orders');
    if (response.ok) {
      const data = await response.json();
      setOrders(data.filter((order: WorkflowOrder) => order.status === 'ready' || order.status === 'delivering'));
    }
  };

  useEffect(() => { void load(); }, []);

  const login = async () => {
    const response = await fetch('/api/auth/employee-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: deliveryToken }),
    });
    if (response.ok) {
      setLoginMessage('Login liberado para a corrida.');
      return;
    }
    const payload = await response.json().catch(() => ({}));
    setLoginMessage(payload.error || 'Acesso bloqueado pela governança.');
  };

  const updateStatus = async (order: WorkflowOrder, status: OrderStatus) => {
    await fetch(`/api/operational-workflow/orders/${order.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'delivery' }),
    });
    await load();
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Entregador</p>
      <h2 className="mt-2 text-2xl font-semibold">Aceite a corrida e acompanhe o status</h2>
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <p className="font-medium text-slate-100">Login do entregador</p>
        <input className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Token de acesso" value={deliveryToken} onChange={(event) => setDeliveryToken(event.target.value)} />
        <button className="mt-3 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => void login()}>Entrar</button>
        {loginMessage ? <p className="mt-3 text-sm text-slate-300">{loginMessage}</p> : null}
      </div>

      <div className="mt-4 space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{order.customerName} • {order.address ?? 'Endereço de teste'}</p>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs uppercase">{formatStatus(order.status)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">Observações: {order.customization ? JSON.stringify(order.customization) : 'Sem observações'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" onClick={() => void updateStatus(order, 'delivering')}>Aceitar corrida</button>
              <button className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300" onClick={() => void updateStatus(order, 'completed')}>Entregue</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
