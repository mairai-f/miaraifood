import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Layers, Sparkles } from 'lucide-react';
import { ProductCard, CategoryChip, SearchBar, QuantityStepper, PrimaryButton } from '@workspace/menu-theme';
import { useTableSession } from '../context/TableSessionContext';
import { getCart, setCart } from '../lib/storage';
import type { MenuItem, CartItem } from '../types';
import { miaifoodQrRequest } from '../lib/miaifood-api';

import StoreHeader from '../components/StoreHeader';
import CategoryDrawer from '../components/CategoryDrawer';
import FloatingCartBar from '../components/FloatingCartBar';
import FeaturedCarousel from '../components/FeaturedCarousel';
import InfoScreen from '../components/InfoScreen';
import ReviewsScreen from '../components/ReviewsScreen';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80';
const ALL_CATEGORIES = 'todas';

export default function MenuScreen() {
  const { qrToken, guestId, tableNumber, restaurant, allowPayAtTable } = useTableSession();
  const navigate = useNavigate();

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNote, setDetailNote] = useState('');
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

  // iFood Tabs & Drawer state
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews' | 'info'>('menu');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Lock body scroll when modal or drawer is open
  useEffect(() => {
    if (detailItem || isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [detailItem, isDrawerOpen]);

  // Cart state for FloatingCartBar
  const [cartState, setCartState] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!qrToken) return;
    setLoading(true);
    miaifoodQrRequest<{ products: Array<{ id:string; name:string; description?:string; price:number; category:string; image_url?:string }> }>({ action: 'resolve', token: qrToken, guestToken: guestId })
      .then((data) => setMenu(data.products.map((item) => ({ id:item.id, restaurantId:'miaifood', name:item.name, description:item.description??'', price:Number(item.price), category:item.category, available:true, prepTime:20, imageUrl:item.image_url }))))
      .catch(() => setMenu([]))
      .finally(() => setLoading(false));
  }, [qrToken, guestId]);

  // Keep local cart state synced for FloatingCartBar
  useEffect(() => {
    if (!qrToken || !guestId) return;
    setCartState(getCart(qrToken, guestId));
  }, [qrToken, guestId, justAdded]);

  // Dynamic categories from restaurant menu
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const item of menu) {
      const c = item.category?.trim();
      if (c && !seen.has(c)) {
        seen.add(c);
        list.push(c);
      }
    }
    return list;
  }, [menu]);

  // Featured / Highlights items (Combos or top selling)
  const featuredItems = useMemo(() => {
    return menu.filter(
      (m) =>
        m.category?.toLowerCase().includes('combo') ||
        m.category?.toLowerCase().includes('destaque') ||
        m.category?.toLowerCase().includes('especial')
    ).slice(0, 6);
  }, [menu]);

  const filteredMenu = useMemo(() => {
    const byCategory = category === ALL_CATEGORIES ? menu : menu.filter((m) => m.category === category);
    const q = search.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter((m) => m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q));
  }, [menu, category, search]);

  // Paginação client-side (05/09/2026, pedido explícito): antes o grid
  // inteiro do cardápio montava de uma vez (todo mundo entra e o navegador
  // já baixa TODAS as fotos de TODOS os itens, mesmo os que o cliente nunca
  // vai rolar até ver) — egress alto à toa. Agora só os primeiros
  // PAGE_SIZE cards existem no DOM (e só esses disparam o loading="lazy"
  // das imagens); "Ver mais" revela o próximo lote sob demanda.
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, search]);
  const visibleMenu = useMemo(() => filteredMenu.slice(0, visibleCount), [filteredMenu, visibleCount]);

  const addToCart = (item: MenuItem, qty: number, note: string, removed: string[] = []) => {
    if (!qrToken || !guestId) return;
    const currentCart = getCart(qrToken, guestId);
    const sameRemoved = (a?: string[], b?: string[]) => {
      const x = [...(a ?? [])].sort();
      const y = [...(b ?? [])].sort();
      return x.length === y.length && x.every((v, i) => v === y[i]);
    };
    const existing = currentCart.find((c) => c.id === item.id && c.note === note && sameRemoved(c.removedIngredients, removed));
    const next: CartItem[] = existing
      ? currentCart.map((c) => (c === existing ? { ...c, qty: c.qty + qty } : c))
      : [...currentCart, { ...item, qty, note, removedIngredients: removed }];

    setCart(qrToken, guestId, next);
    setCartState(next);
    setJustAdded(item.id);
    setTimeout(() => setJustAdded(null), 1200);
  };

  const openDetail = (item: MenuItem) => {
    setDetailItem(item);
    setDetailQty(1);
    setDetailNote('');
    setRemovedIngredients([]);
  };

  const toggleIngredient = (ingredient: string) => {
    setRemovedIngredients((prev) =>
      prev.includes(ingredient) ? prev.filter((i) => i !== ingredient) : [...prev, ingredient]
    );
  };

  const confirmDetail = () => {
    if (!detailItem) return;
    addToCart(detailItem, detailQty, detailNote.trim(), removedIngredients);
    setDetailItem(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-400 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--menu-primary)] border-t-transparent" />
        <p className="text-sm font-semibold">Carregando cardápio da loja…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Store Header Component */}
      <StoreHeader
        restaurant={restaurant}
        tableNumber={tableNumber}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab 2: Reviews / Avaliações */}
      {activeTab === 'reviews' && <ReviewsScreen restaurant={restaurant} />}

      {/* Tab 3: Store Info / Informações */}
      {activeTab === 'info' && (
        <InfoScreen
          restaurant={restaurant}
          tableNumber={tableNumber}
          allowPayAtTable={allowPayAtTable}
        />
      )}

      {/* Tab 1: Menu / Cardápio (Default) */}
      {activeTab === 'menu' && (
        <div className="flex flex-col gap-4 px-4">
          {/* Search Bar & Full Menu Drawer Trigger */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} placeholder="Buscar no cardápio..." />
            </div>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-[var(--menu-surface)] border border-white/10 text-xs font-bold hover:border-[var(--menu-primary)] transition-colors text-white shadow-sm shrink-0"
              title="Cardápio Completo"
            >
              <Layers className="h-4 w-4 text-[var(--menu-primary)]" />
              <span className="hidden sm:inline">Categorias</span>
            </button>
          </div>

          {/* Featured Carousel (Destaques da Casa) */}
          {!search && category === ALL_CATEGORIES && featuredItems.length > 0 && (
            <FeaturedCarousel
              items={featuredItems}
              onSelectItem={openDetail}
              onQuickAdd={(item) => addToCart(item, 1, '')}
            />
          )}

          {/* Category Chips Scrollbar */}
          {categories.length > 1 && (
            <div className="flex w-full gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory touch-pan-x scroll-smooth select-none">
              <CategoryChip
                label="Todas"
                active={category === ALL_CATEGORIES}
                onClick={() => setCategory(ALL_CATEGORIES)}
              />
              {categories.map((c) => (
                <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
              ))}
            </div>
          )}

          {/* Menu Empty State */}
          {!filteredMenu.length && (
            <div className="p-12 text-center text-zinc-400 font-medium">Nenhum item encontrado no cardápio.</div>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleMenu.map((item) => (
              <ProductCard
                key={item.id}
                imageUrl={item.imageUrl?.trim() || PLACEHOLDER_IMG}
                name={item.name}
                description={item.description}
                price={item.price}
                onClick={() => openDetail(item)}
                onAdd={() => addToCart(item, 1, '')}
              />
            ))}
          </div>

          {visibleCount < filteredMenu.length && (
            <button
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="mx-auto mt-1 rounded-full border border-white/15 bg-[var(--menu-surface)] px-6 py-2.5 text-xs font-bold text-white hover:border-[var(--menu-primary)] transition-colors"
            >
              Ver mais ({filteredMenu.length - visibleCount} restantes)
            </button>
          )}
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      <FloatingCartBar cart={cartState} tableNumber={tableNumber} />

      {/* Full Menu Category Drawer */}
      <CategoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        categories={categories}
        menuItems={menu}
        selectedCategory={category}
        onSelectCategory={setCategory}
      />

      {/* Just Added Toast */}
      {justAdded && (
        <div
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-2xl animate-bounce"
          style={{ background: 'var(--menu-primary, #ea1d2c)' }}
        >
          Item adicionado à sacola ✓
        </div>
      )}

      {/* iFood-Style Item Detail Modal */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4 transition-all"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-[28px] sm:rounded-[28px] overflow-hidden shadow-2xl border border-white/10 animate-in slide-in-from-bottom duration-300"
            style={{ background: 'var(--menu-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-60 w-full bg-zinc-900">
              <img
                src={detailItem.imageUrl?.trim() || PLACEHOLDER_IMG}
                alt={detailItem.name}
                decoding="async"
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => setDetailItem(null)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 p-5 max-h-[70vh] overflow-y-auto overscroll-contain">
              <div>
                <p className="text-xl font-black tracking-tight" style={{ color: 'var(--menu-text)' }}>
                  {detailItem.name}
                </p>
                {detailItem.description && (
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{detailItem.description}</p>
                )}
              </div>

              <p className="text-2xl font-black text-[var(--menu-primary)] tracking-tight">
                {detailItem.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 border border-white/5 bg-zinc-900/60">
                <span className="text-sm font-semibold text-zinc-300">Quantidade</span>
                <QuantityStepper value={detailQty} onChange={setDetailQty} min={1} max={20} />
              </div>

              {/* Remove Ingredients Option */}
              {Boolean(detailItem.ingredientes?.length) && (
                <div className="rounded-2xl p-3.5 border border-white/5 bg-zinc-900/60 flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Tirar algum ingrediente?</p>
                  <div className="flex flex-col gap-2 mt-1">
                    {detailItem.ingredientes!.map((ingredient) => (
                      <label key={ingredient} className="flex items-center gap-2.5 text-sm cursor-pointer text-zinc-200">
                        <input
                          type="checkbox"
                          checked={removedIngredients.includes(ingredient)}
                          onChange={() => toggleIngredient(ingredient)}
                          className="h-4 w-4 rounded border-white/20 bg-zinc-800 text-[var(--menu-primary)] focus:ring-0"
                        />
                        <span className={removedIngredients.includes(ingredient) ? 'opacity-40 line-through' : 'font-medium'}>
                          {ingredient}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Observations Input */}
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Observação (opcional)
                <textarea
                  value={detailNote}
                  onChange={(e) => setDetailNote(e.target.value)}
                  placeholder="Ex.: sem cebola, ponto da carne bem passado..."
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-2xl p-3 text-sm outline-none border border-white/10 bg-zinc-900 text-white placeholder:text-zinc-500 focus:border-[var(--menu-primary)] transition-colors"
                />
              </label>

              {/* Add to Cart CTA */}
              <PrimaryButton onClick={confirmDetail}>
                Adicionar • {(detailItem.price * detailQty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </PrimaryButton>

              <button
                type="button"
                onClick={() => {
                  confirmDetail();
                  navigate('/cart');
                }}
                className="text-center text-xs font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Adicionar e ver sacola
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
