import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowLeft, QrCode, CheckCircle2 } from 'lucide-react';
import { QuantityStepper, PrimaryButton, SuccessPopup } from '@workspace/menu-theme';
import { useTableSession } from '../context/TableSessionContext';
import { getCart, setCart as persistCart } from '../lib/storage';
import WaiterCallButton from '../components/WaiterCallButton';
import UpsellCarousel from '../components/UpsellCarousel';
import type { CartItem, MenuItem } from '../types';
import { miaifoodQrRequest } from '../lib/miaifood-api';

export default function CartScreen() {
  const { qrToken, guestId, tableNumber, allowPayAtTable } = useTableSession();
  const navigate = useNavigate();
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [placing, setPlacing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!qrToken || !guestId) return;
    setCartState(getCart(qrToken, guestId));
  }, [qrToken, guestId]);

  // Fetch full menu to provide cross-selling "Peça também" recommendations (e.g. Beverages, Desserts)
  useEffect(() => {
    if (!qrToken) return;
    miaifoodQrRequest<{ products: Array<{ id:string; name:string; description?:string; price:number; category:string; image_url?:string }> }>({ action: 'resolve', token: qrToken, guestToken: guestId })
      .then((data) => setMenuItems(data.products.map((item) => ({ id:item.id, restaurantId:'miaifood', name:item.name, description:item.description??'', price:Number(item.price), category:item.category, available:true, prepTime:20, imageUrl:item.image_url }))))
      .catch(() => setMenuItems([]));
  }, [qrToken, guestId]);

  // Filter upsell candidates (Beverages, Drinks, Desserts not yet in cart)
  const upsellCandidates = useMemo(() => {
    const cartIds = new Set(cart.map((c) => c.id));
    return menuItems.filter(
      (m) =>
        !cartIds.has(m.id) &&
        (m.category?.toLowerCase().includes('bebid') ||
          m.category?.toLowerCase().includes('doce') ||
          m.category?.toLowerCase().includes('sobremesa') ||
          m.category?.toLowerCase().includes('porção'))
    ).slice(0, 6);
  }, [menuItems, cart]);

  const update = (next: CartItem[]) => {
    setCartState(next);
    if (qrToken && guestId) persistCart(qrToken, guestId, next);
  };

  const setQty = (id: string, qty: number) =>
    update(cart.flatMap((c) => (c.id === id ? (qty <= 0 ? [] : [{ ...c, qty }]) : [c])));

  const remove = (id: string) => update(cart.filter((c) => c.id !== id));

  const addUpsellItem = (item: MenuItem) => {
    if (!qrToken || !guestId) return;
    const existing = cart.find((c) => c.id === item.id && !c.note && (!c.removedIngredients || c.removedIngredients.length === 0));
    const next: CartItem[] = existing
      ? cart.map((c) => (c === existing ? { ...c, qty: c.qty + 1 } : c))
      : [...cart, { ...item, qty: 1, note: '', removedIngredients: [] }];
    update(next);
  };

  const total = cart.reduce((s, c) => s + c.qty * c.price, 0);

  const placeOrder = async () => {
    if (!qrToken || !guestId || !cart.length) return;
    setPlacing(true);
    setErrorMessage('');
    try {
      await miaifoodQrRequest({
        action: 'submit', token: qrToken, guestToken: guestId,
        items: cart.map((c) => ({ productId: c.id, quantity: c.qty, notes: [c.removedIngredients?.length ? `Sem: ${c.removedIngredients.join(', ')}.` : '', c.note].filter(Boolean).join(' ').trim() })),
      });
      update([]);
      setSuccess(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-20">
      {/* Header bar */}
      <div className="flex items-center justify-between py-2 border-b border-white/10">
        <button
          onClick={() => navigate('/menu')}
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao cardápio
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <QrCode className="h-3.5 w-3.5" />
          {tableNumber ? `Mesa ${tableNumber}` : 'Consumo Local'}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--menu-text)' }}>
          Sua Sacola
        </h2>
        {Boolean(cart.length) && (
          <span className="text-xs font-bold text-zinc-400 bg-white/10 px-2.5 py-1 rounded-full">
            {cart.reduce((a, b) => a + b.qty, 0)} itens
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 font-medium">
          {errorMessage}
        </div>
      )}

      {/* Empty State */}
      {!cart.length && (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--menu-surface)] rounded-2xl border border-white/5 gap-3">
          <ShoppingBag className="h-12 w-12 text-zinc-500" />
          <div>
            <p className="text-base font-bold text-white">Sua sacola está vazia</p>
            <p className="text-xs text-zinc-400 mt-1">Adicione deliciosos itens do cardápio para fazer seu pedido.</p>
          </div>
          <button
            onClick={() => navigate('/menu')}
            className="mt-2 px-5 py-2.5 rounded-full bg-[var(--menu-primary)] text-white font-bold text-xs shadow-lg hover:opacity-90 transition-all"
          >
            Ver cardápio
          </button>
        </div>
      )}

      {/* Cart Items List */}
      {cart.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl p-3.5 border border-white/10 flex flex-col gap-2 shadow-sm transition-all"
          style={{ background: 'var(--menu-surface)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-bold text-sm text-white">{item.name}</p>
              {Boolean(item.removedIngredients?.length) && (
                <p className="text-xs text-amber-400 font-medium mt-0.5">
                  Sem: {item.removedIngredients!.join(', ')}
                </p>
              )}
              {item.note && (
                <p className="text-xs text-zinc-400 italic mt-0.5">Obs: "{item.note}"</p>
              )}
              <p className="text-sm font-extrabold text-[var(--menu-primary)] mt-1">
                {(item.price * item.qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <QuantityStepper value={item.qty} onChange={(q) => setQty(item.id, q)} min={0} />
              <button
                onClick={() => remove(item.id)}
                className="opacity-50 hover:opacity-100 hover:text-red-400 p-1 transition-colors"
                style={{ color: 'var(--menu-text)' }}
                title="Remover item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* "Peça Também" Upsell Carousel */}
      {Boolean(cart.length) && (
        <UpsellCarousel items={upsellCandidates} onAdd={addUpsellItem} />
      )}

      {/* Value Summary Card */}
      {Boolean(cart.length) && (
        <div className="rounded-2xl p-4 border border-white/10 flex flex-col gap-2.5 bg-zinc-900/90 shadow-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Subtotal dos itens</span>
            <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Atendimento na mesa</span>
            <span className="text-emerald-400 font-bold">Grátis</span>
          </div>

          <div className="border-t border-white/10 pt-2 flex items-center justify-between">
            <span className="font-bold text-base text-white">Total do pedido</span>
            <span className="text-xl font-black text-[var(--menu-primary)]">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      )}

      {/* Order CTA */}
      <PrimaryButton onClick={placeOrder} disabled={!cart.length || placing} loading={placing}>
        Fazer pedido • {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </PrimaryButton>

      {/* Waiter Call Button */}
      <WaiterCallButton />

      {/* Close Bill CTA */}
      <button
        onClick={() => navigate('/bill')}
        className="w-full rounded-2xl py-3 text-xs font-bold text-zinc-300 hover:text-white border border-white/15 bg-zinc-900/60 hover:bg-zinc-900 transition-all shadow-sm"
      >
        Fechar ou dividir conta da mesa
      </button>

      <SuccessPopup
        open={success}
        title="Pedido enviado com sucesso!"
        message="Seu pedido foi registrado e já está na fila de preparo da cozinha."
        onClose={() => {
          setSuccess(false);
          navigate('/menu');
        }}
      />
    </div>
  );
}
