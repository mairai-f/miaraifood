import { useMemo, useState, useEffect } from 'react';
import { Search, Plus, Minus, X, Check } from 'lucide-react';
import { useTableSession } from '../context/TableSessionContext';
import type { MenuItem, CartItem } from '../types';
import StoreHeader from '../components/StoreHeader';
import FloatingCartBar from '../components/FloatingCartBar';
import WaiterCallButton from '../components/WaiterCallButton';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80';

export default function MenuScreen({ onOpenCart }: { onOpenCart: () => void }) {
  const { establishmentName, table, products, cart, updateCart } = useTableSession();
  const [category, setCategory] = useState<string>('todas');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews' | 'info'>('menu');
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState('');
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (detailItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [detailItem]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    try {
      const stored = localStorage.getItem('qrmenu_custom_categories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) parsed.forEach((c: string) => {
          if (c && typeof c === 'string' && c.trim()) set.add(c.trim());
        });
      }
    } catch {}
    products.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = category === 'todas' ? products : products.filter((p) => (p.category?.trim() || 'Outros') === category);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
    }
    return list;
  }, [products, category, search]);

  const handleAddToCart = (item: MenuItem, qty: number, notes: string) => {
    updateCart((current) => {
      const existingIndex = current.findIndex((c) => c.productId === item.id && (c.notes || '') === notes);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + qty,
        };
        return next;
      }
      const newItem: CartItem = {
        id: `${item.id}-${Date.now()}`,
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: qty,
        imageUrl: item.imageUrl,
        notes,
      };
      return [...current, newItem];
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const confirmDetail = () => {
    if (!detailItem) return;
    handleAddToCart(detailItem, detailQty, detailNotes.trim());
    setDetailItem(null);
  };

  return (
    <div className="min-h-screen pb-28">
      <StoreHeader
        establishmentName={establishmentName}
        tableName={table?.name || table?.code}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'menu' && (
        <div className="flex flex-col gap-4 px-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pratos ou bebidas..."
              className="w-full rounded-2xl bg-slate-900 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="mb-2">
            <WaiterCallButton />
          </div>

          <div className="flex w-full gap-2 overflow-x-auto pb-1 scrollbar-none snap-x touch-pan-x">
            <button
              type="button"
              onClick={() => setCategory('todas')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                category === 'todas'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  category === cat
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {!filteredProducts.length && (
            <div className="py-12 text-center text-slate-400 font-medium">Nenhum item encontrado no cardápio.</div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setDetailItem(item);
                  setDetailQty(1);
                  setDetailNotes('');
                }}
                style={{ backgroundColor: 'var(--menu-card-bg)', color: 'var(--menu-card-text)' }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 shadow-lg cursor-pointer hover:opacity-95 transition"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/20">
                  <img src={item.imageUrl || PLACEHOLDER_IMG} alt={item.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm">{item.name}</p>
                  {item.description && (
                    <p className="line-clamp-2 text-xs opacity-70 mt-0.5">{item.description}</p>
                  )}
                  <p className="mt-1.5 font-bold text-sm" style={{ color: 'var(--menu-primary)' }}>
                    {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(item, 1, '');
                  }}
                  style={{ backgroundColor: 'var(--menu-primary)' }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-bold hover:brightness-110 shadow-md"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="px-4 py-8 text-center opacity-80">
          <p className="font-semibold text-lg">Avaliações da Mesa</p>
          <p className="mt-1 text-sm">★ 4.9 (420+ avaliações positivas no MIAR AI/FOOD)</p>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="px-4 py-6 space-y-4">
          <div className="rounded-2xl border border-white/10 p-4" style={{ backgroundColor: 'var(--menu-card-bg)', color: 'var(--menu-card-text)' }}>
            <p className="font-bold text-base">{establishmentName}</p>
            <p className="text-sm mt-1 opacity-70">Mesa: {table?.name || table?.code}</p>
            <p className="text-xs mt-3 opacity-50">Cardápio digital via MIAR AI/FOOD QR Code</p>
          </div>
        </div>
      )}

      <FloatingCartBar cart={cart} tableName={table?.name || table?.code} onOpenCart={onOpenCart} />

      {justAdded && (
        <div
          style={{ backgroundColor: 'var(--menu-primary)' }}
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-2xl flex items-center gap-2"
        >
          <Check className="h-4 w-4" /> Item adicionado à sacola!
        </div>
      )}

      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-[28px] sm:rounded-[28px] overflow-hidden shadow-2xl border border-white/10"
            style={{ backgroundColor: 'var(--menu-modal-bg)', color: 'var(--menu-modal-text)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-48 w-full bg-black/40">
              <img src={detailItem.imageUrl || PLACEHOLDER_IMG} alt={detailItem.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-lg font-bold">{detailItem.name}</p>
                {detailItem.description && <p className="text-xs opacity-75 mt-1">{detailItem.description}</p>}
                <p className="mt-2 text-xl font-extrabold" style={{ color: 'var(--menu-primary)' }}>
                  {detailItem.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-black/20 p-3 border border-white/10">
                <span className="text-xs font-semibold">Quantidade</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/30 font-bold"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-4 text-center font-bold text-slate-100">{detailQty}</span>
                  <button
                    type="button"
                    onClick={() => setDetailQty((q) => q + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-200 font-bold"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Observação (opcional)
                <textarea
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  placeholder="Ex.: Sem cebola, bem passado..."
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-xl bg-slate-950 p-3 text-xs outline-none border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-emerald-500"
                />
              </label>

              <button
                type="button"
                onClick={confirmDetail}
                className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-slate-950 hover:bg-emerald-400 transition"
              >
                Adicionar • {(detailItem.price * detailQty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
