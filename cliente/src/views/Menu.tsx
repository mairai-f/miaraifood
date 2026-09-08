import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Trash2, ChevronLeft, X, Loader2, ChefHat, Bike, Store } from 'lucide-react';
import { lsGet, lsSet, cartKey, getClientToken } from '../lib/storage';
import type { Restaurant, MenuItem, CartItem, OrderMode } from '../types';
import { getSupabaseClient } from '@workspace/api-client-react';
import PagamentoPix from '../components/PagamentoPix';
import ProductDetailModal from '../components/ProductDetailModal';
import {
  MenuThemeProvider,
  DEFAULT_MENU_THEME,
  mergeMenuTheme,
  ProductCard,
  CategoryChip,
  SearchBar,
  QuantityStepper,
  PrimaryButton,
  SuccessPopup,
  type MenuTheme,
} from '@workspace/menu-theme';

type MenuItemWithPhoto = MenuItem & { imageUrl?: string | null };

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/5 ${className}`} />;
}

export default function Menu({
  restaurant,
  tableId,
  tableToken,
  guestId,
  onBack,
  onOrderPlaced,
  isGuest,
  onRequireLogin,
  onOpenReservation,
}: {
  restaurant: Restaurant;
  tableId?: string;
  tableToken?: string;
  guestId?: string;
  onBack: () => void;
  onOrderPlaced: (orderId: string, mode: OrderMode, items: CartItem[], total: number) => void;
  isGuest: boolean;
  onRequireLogin: () => void;
  onOpenReservation?: () => void;
}) {
  const [menu, setMenu] = useState<MenuItemWithPhoto[]>([]);
  const [cart, setCartState] = useState<CartItem[]>(() => lsGet(cartKey(restaurant.id), []));
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModeModal, setShowModeModal] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [showPix, setShowPix] = useState(false);
  const [pixModeSelection, setPixModeSelection] = useState(false);
  const [pixMode, setPixMode] = useState<OrderMode>('dine-in');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [theme, setTheme] = useState<MenuTheme>(DEFAULT_MENU_THEME);
  const [placedOrder, setPlacedOrder] = useState<{
    orderId: string;
    mode: OrderMode;
    items: CartItem[];
    total: number;
  } | null>(null);

  // Selected product for ProductDetailModal
  const [selectedProduct, setSelectedProduct] = useState<MenuItemWithPhoto | null>(null);

  // Scroll lock when cart or modal open
  useEffect(() => {
    if (showCart || showModeModal || Boolean(selectedProduct)) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showCart, showModeModal, selectedProduct]);

  useEffect(() => {
    setLoading(true);
    getSupabaseClient().from('miaifood_public_menu').select('*').eq('restaurant_id', restaurant.id).order('sort_order', { ascending: true })
      .then(({ data }) => {
        const d = (data ?? []).map((row: any) => ({ id: row.product_id, name: row.name, category: row.category, price: Number(row.price), description: row.description, imageUrl: row.image_url, featured: row.featured }));
        setMenu(d as MenuItemWithPhoto[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch(`/api/restaurants/${restaurant.id}/menu-theme`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => {
        if (t) setTheme(mergeMenuTheme(t));
      })
      .catch(() => {});
  }, [restaurant.id]);

  const setCart = (c: CartItem[]) => {
    setCartState(c);
    lsSet(cartKey(restaurant.id), c);
  };

  const setItemQty = useCallback(
    (item: CartItem, qty: number) => {
      setCartState((prev) => {
        const next =
          qty <= 0
            ? prev.filter((c) => c.id !== item.id)
            : prev.map((c) => (c.id === item.id ? { ...c, qty } : c));
        lsSet(cartKey(restaurant.id), next);
        return next;
      });
    },
    [restaurant.id]
  );

  const handleAddToCartWithNote = (item: MenuItem, qty: number, obs: string) => {
    setCartState((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.id === item.id && (c.note || '') === (obs || '')
      );
      let next: CartItem[];
      if (existingIndex >= 0) {
        next = [...prev];
        next[existingIndex] = { ...next[existingIndex], qty: next[existingIndex].qty + qty };
      } else {
        next = [...prev, { ...item, qty, note: obs }];
      }
      lsSet(cartKey(restaurant.id), next);
      return next;
    });
    setSelectedProduct(null);
  };

  const updateNote = (id: string, note: string) =>
    setCart(cart.map((c) => (c.id === id ? { ...c, note } : c)));

  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  const totalPrice = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const categories = [...new Set(menu.map((m) => m.category ?? 'Cardápio'))];
  const filtered = menu
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => !activeCategory || (m.category ?? 'Cardápio') === activeCategory);

  const checkout = async (mode: OrderMode, paymentMethod?: string, paymentId?: string) => {
    if (isGuest) {
      onRequireLogin();
      return;
    }
    if (!cart.length) return;
    if (mode === 'dine-in' && tableToken && !guestId) {
      setSuccess('A sessão da mesa ainda está a abrir. Aguarde um instante e tente novamente.');
      return;
    }
    setOrdering(true);
    setShowModeModal(false);
    try {
      const clientToken = getClientToken();
      const orderHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clientToken) orderHeaders['Authorization'] = `Bearer ${clientToken}`;

      const itemsSnap = [...cart];
      const totalSnap = totalPrice;
      const isQrSessionOrder =
        mode === 'dine-in' && Boolean(tableToken && guestId) && !paymentMethod && !paymentId;
      const res = isQrSessionOrder
        ? await getSupabaseClient().rpc('submit_food_order_for_guest', {
            p_guest_session_id: guestId,
            p_items: cart.map((c) => ({ product_id: c.id, product_name: c.name, quantity: c.qty, unit_price: c.price, notes: c.note || '' })),
          }).then(({ data, error }) => ({ ok: !error, json: async () => ({ orderId: data, error: error?.message }) }))
        : await fetch('/api/orders', {
            method: 'POST',
            headers: orderHeaders,
            body: JSON.stringify({
              restaurantId: restaurant.id,
              items: cart.map((c) => ({
                menuItemId: c.id,
                quantity: c.qty,
                notes: c.note || undefined,
              })),
              mode,
              ...(mode === 'pickup' && vehiclePlate.trim()
                ? { vehiclePlate: vehiclePlate.trim() }
                : {}),
              ...(mode === 'dine-in' && tableId ? { tableId } : {}),
              ...(paymentMethod ? { paymentMethod } : {}),
              ...(paymentId ? { paymentId } : {}),
            }),
          });
      if (res.ok) {
        const order = (await res.json()) as { id?: string; orderId?: string };
        const resolvedOrderId = order.orderId ?? order.id;
        if (!resolvedOrderId) {
          setSuccess('O servidor não confirmou a criação do pedido. O carrinho foi mantido.');
          return;
        }
        setCart([]);
        setShowCart(false);
        setVehiclePlate('');
        setPlacedOrder({ orderId: resolvedOrderId, mode, items: itemsSnap, total: totalSnap });
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSuccess(data.error ?? 'Não foi possível registrar o pedido. O carrinho foi mantido.');
      }
    } catch {
      setSuccess('Não foi possível conectar ao servidor. O pedido não foi criado.');
    } finally {
      setOrdering(false);
    }
  };

  const selectMode = (mode: OrderMode, paymentMethod?: string) => {
    if (pixModeSelection && !paymentMethod) {
      setPixMode(mode);
      setPixModeSelection(false);
      setShowModeModal(false);
      setShowPix(true);
      return;
    }
    void checkout(mode, paymentMethod);
  };

  return (
    <MenuThemeProvider theme={theme}>
      <div className="client-menu client-dark-theme min-h-screen">
        <header
          className="client-menu-header sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur"
          style={{
            background: 'color-mix(in srgb, var(--menu-bg) 90%, transparent)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <button
            onClick={onBack}
            className="rounded-full p-2"
            style={{ background: 'var(--menu-surface)' }}
          >
            <ChevronLeft className="h-4 w-4" style={{ color: 'var(--menu-text)' }} />
          </button>
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--menu-text)' }}>
              {restaurant.name}
            </p>
            <p className="text-xs capitalize" style={{ color: 'var(--menu-primary)' }}>
              {activeCategory ? `Categoria: ${activeCategory}` : (restaurant.segment ?? restaurant.cuisine)}
            </p>
          </div>
          {onOpenReservation && (
            <button
              onClick={onOpenReservation}
              aria-label="Reservar mesa"
              className="mr-2 rounded-full px-3 py-2 text-sm font-semibold"
              style={{ background: 'var(--menu-surface)', color: 'var(--menu-text)' }}
            >
              Reservar
            </button>
          )}
          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--menu-primary)' }}
          >
            <ShoppingCart className="h-4 w-4" />
            {totalItems > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold"
                style={{ color: 'var(--menu-primary)' }}
              >
                {totalItems}
              </span>
            )}
            R$ {totalPrice.toFixed(2)}
          </button>
        </header>

        {success && (
          <div className="mx-4 mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
            {success}
          </div>
        )}

        <div className="p-4">
          <div className="mb-4">
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar no cardápio..." />
          </div>

          {categories.length > 1 && (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              <CategoryChip
                label="Todos"
                active={activeCategory === null}
                onClick={() => setActiveCategory(null)}
              />
              {categories.map((cat) => (
                <CategoryChip
                  key={cat}
                  label={cat}
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                />
              ))}
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-52 w-full" />
              ))}
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((item) => (
                <div key={item.id} onClick={() => setSelectedProduct(item)} className="cursor-pointer">
                  <ProductCard
                    name={item.name}
                    description={item.description}
                    price={item.price}
                    imageUrl={item.imageUrl}
                    onAdd={() => setSelectedProduct(item)}
                  />
                </div>
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p
              className="rounded-2xl p-8 text-center opacity-60"
              style={{ background: 'var(--menu-surface)', color: 'var(--menu-text)' }}
            >
              Nenhum item encontrado
            </p>
          )}
        </div>

        {/* Mode modal */}
        <AnimatePresence>
          {showModeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end bg-black/80 backdrop-blur"
              onClick={() => {
                setShowModeModal(false);
                setPixModeSelection(false);
              }}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-t-[28px] p-6 shadow-2xl relative"
                style={{ background: 'var(--menu-surface)' }}
              >
                {/* Close Button X */}
                <button
                  onClick={() => {
                    setShowModeModal(false);
                    setPixModeSelection(false);
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full opacity-70 hover:opacity-100"
                  style={{ color: 'var(--menu-text)' }}
                >
                  <X className="h-5 w-5" />
                </button>

                <p className="mb-1 text-lg font-semibold" style={{ color: 'var(--menu-text)' }}>
                  Como vai receber o pedido?
                </p>
                <p className="mb-5 text-sm opacity-60" style={{ color: 'var(--menu-text)' }}>
                  {pixModeSelection
                    ? 'Escolha a forma de recebimento antes de pagar com Pix'
                    : 'Escolha a forma de recebimento'}
                </p>
                <label className="mb-4 block text-sm opacity-80" style={{ color: 'var(--menu-text)' }}>
                  Placa do veículo para retirada
                  <input
                    value={vehiclePlate}
                    onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
                    placeholder="ABC1D34"
                    maxLength={8}
                    className="mt-2 w-full rounded-xl px-3 py-2 text-base tracking-widest text-white focus:outline-none"
                    style={{
                      background: 'var(--menu-bg)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  />
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => selectMode('dine-in')}
                    disabled={ordering}
                    className="flex flex-col items-center gap-2 rounded-2xl p-4 disabled:opacity-50"
                    style={{
                      background: 'var(--menu-bg)',
                      border: '2px solid var(--menu-primary)',
                      color: 'var(--menu-text)',
                    }}
                  >
                    <ChefHat className="h-7 w-7" style={{ color: 'var(--menu-primary)' }} />
                    <span className="font-semibold text-sm">Na mesa</span>
                    <span className="text-xs opacity-60">Salão / balcão</span>
                  </button>
                  <button
                    onClick={() => selectMode('delivery')}
                    disabled={ordering}
                    className="flex flex-col items-center gap-2 rounded-2xl p-4 disabled:opacity-50"
                    style={{
                      background: 'var(--menu-bg)',
                      border: '2px solid var(--menu-primary)',
                      color: 'var(--menu-text)',
                    }}
                  >
                    <Bike className="h-7 w-7" style={{ color: 'var(--menu-primary)' }} />
                    <span className="font-semibold text-sm">Delivery</span>
                    <span className="text-xs opacity-60">Entrega em casa</span>
                  </button>
                  <button
                    onClick={() => selectMode('pickup', pixModeSelection ? undefined : 'no_caixa')}
                    disabled={ordering || !vehiclePlate.trim()}
                    className="flex flex-col items-center gap-2 rounded-2xl p-4 disabled:opacity-50"
                    style={{
                      background: 'var(--menu-bg)',
                      border: '2px solid var(--menu-primary)',
                      color: 'var(--menu-text)',
                    }}
                  >
                    <Store className="h-7 w-7" style={{ color: 'var(--menu-primary)' }} />
                    <span className="font-semibold text-sm">Retirar</span>
                    <span className="text-xs opacity-60">Pagar no caixa</span>
                  </button>
                </div>
                {ordering && (
                  <div
                    className="mt-4 flex items-center justify-center gap-2 text-sm opacity-60"
                    style={{ color: 'var(--menu-text)' }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cart drawer */}
        <AnimatePresence>
          {showCart && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end bg-black/80 backdrop-blur"
              onClick={() => setShowCart(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[85vh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] p-5 shadow-2xl"
                style={{ background: 'var(--menu-surface)' }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--menu-text)' }}>
                    Seu pedido
                  </h3>
                  <button
                    onClick={() => setShowCart(false)}
                    className="rounded-full p-2"
                    style={{ background: 'var(--menu-bg)' }}
                  >
                    <X className="h-4 w-4" style={{ color: 'var(--menu-text)' }} />
                  </button>
                </div>

                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl p-3"
                      style={{ background: 'var(--menu-bg)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium" style={{ color: 'var(--menu-text)' }}>
                            {item.name}
                          </p>
                          <p className="text-sm font-semibold" style={{ color: 'var(--menu-primary)' }}>
                            R$ {(item.price * item.qty).toFixed(2)}
                          </p>
                        </div>
                        <QuantityStepper
                          value={item.qty}
                          min={0}
                          onChange={(qty) => setItemQty(item, qty)}
                        />
                        <button
                          onClick={() => setCart(cart.filter((c) => c.id !== item.id))}
                          className="ml-1 opacity-60 hover:opacity-100"
                          style={{ color: 'var(--menu-text)' }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        value={item.note}
                        onChange={(e) => updateNote(item.id, e.target.value)}
                        placeholder="Observação (sem cebola, bem passado…)"
                        className="mt-2 w-full rounded-lg px-3 py-1.5 text-xs placeholder-white/30 focus:outline-none"
                        style={{
                          background: 'var(--menu-surface)',
                          color: 'var(--menu-text)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  className="mt-4 flex items-center justify-between rounded-2xl p-3"
                  style={{ background: 'var(--menu-bg)' }}
                >
                  <span className="font-medium opacity-70" style={{ color: 'var(--menu-text)' }}>
                    Total
                  </span>
                  <span className="text-xl font-bold" style={{ color: 'var(--menu-primary)' }}>
                    R$ {totalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="mt-4">
                  <PrimaryButton
                    onClick={() => {
                      if (isGuest) {
                        setShowCart(false);
                        onRequireLogin();
                        return;
                      }
                      setShowCart(false);
                      setPixModeSelection(false);
                      setShowModeModal(true);
                    }}
                    disabled={!cart.length}
                  >
                    Continuar →
                  </PrimaryButton>
                </div>
                <button
                  onClick={() => {
                    if (isGuest) {
                      onRequireLogin();
                      return;
                    }
                    setShowCart(false);
                    setPixModeSelection(true);
                    setShowModeModal(true);
                  }}
                  disabled={!cart.length}
                  className="mt-2 w-full rounded-full py-3 font-semibold transition disabled:opacity-50"
                  style={{ border: '1px solid var(--menu-primary)', color: 'var(--menu-primary)' }}
                >
                  Pagar com Pix
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {showPix && (
          <PagamentoPix
            valor={totalPrice}
            descricao={`Pedido ${restaurant.name}`}
            onFechar={() => setShowPix(false)}
            onPago={(paymentId) => {
              setShowPix(false);
              void checkout(pixMode, 'pix', paymentId);
            }}
          />
        )}

        {/* Product Detail Modal */}
        {selectedProduct && (
          <ProductDetailModal
            product={{ ...selectedProduct, restaurantName: restaurant.name }}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={(item, qty, obs) => handleAddToCartWithNote(item, qty, obs)}
          />
        )}

        <SuccessPopup
          open={Boolean(placedOrder)}
          title="Pedido enviado!"
          message="Você já pode acompanhar o andamento do seu pedido."
          closeLabel="Acompanhar pedido"
          onClose={() => {
            if (!placedOrder) return;
            const { orderId, mode, items, total } = placedOrder;
            setPlacedOrder(null);
            onOrderPlaced(orderId, mode, items, total);
          }}
        />
      </div>
    </MenuThemeProvider>
  );
}
