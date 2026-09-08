import { useState } from 'react';
import { Trash2, ShoppingBag, ArrowLeft, CheckCircle2, Loader2, QrCode } from 'lucide-react';
import { useTableSession } from '../context/TableSessionContext';
import type { CartItem } from '../types';
import WaiterCallButton from '../components/WaiterCallButton';

export default function CartScreen({
  onBackToMenu,
  onGoToBill,
}: {
  onBackToMenu: () => void;
  onGoToBill: () => void;
}) {
  const { table, cart, updateCart, submitOrder } = useTableSession();
  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const total = cart.reduce((s, c) => s + c.quantity * c.price, 0);

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      updateCart((prev) => prev.filter((c) => c.id !== id));
    } else {
      updateCart((prev) => prev.map((c) => (c.id === id ? { ...c, quantity: qty } : c)));
    }
  };

  const handlePlaceOrder = async () => {
    if (!cart.length || placing) return;
    setPlacing(true);
    setErrorMsg('');
    try {
      const itemsPayload = cart.map((c) => ({
        productId: c.productId,
        quantity: c.quantity,
        notes: c.notes || undefined,
      }));
      const res = await submitOrder(itemsPayload);
      if (res.success) {
        setSuccess(true);
      } else {
        setErrorMsg(res.error || 'Não foi possível registrar seu pedido.');
      }
    } catch {
      setErrorMsg('Erro de conexão ao enviar o pedido.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-24 text-slate-100 min-h-screen">
      <div className="flex items-center justify-between py-3 border-b border-slate-800">
        <button
          type="button"
          onClick={onBackToMenu}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao cardápio
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <QrCode className="h-3.5 w-3.5" />
          {table?.name || table?.code ? `Mesa ${table.name || table.code}` : 'Atendimento Mesa'}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">Sua Sacola</h2>
        {cart.length > 0 && (
          <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
            {cart.reduce((a, b) => a + b.quantity, 0)} itens
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 font-medium">
          {errorMsg}
        </div>
      )}

      {!cart.length && !success && (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 gap-3 my-4">
          <ShoppingBag className="h-12 w-12 text-slate-600" />
          <div>
            <p className="text-base font-bold text-slate-200">Sua sacola está vazia</p>
            <p className="text-xs text-slate-400 mt-1">Adicione produtos do cardápio para pedir.</p>
          </div>
          <button
            type="button"
            onClick={onBackToMenu}
            className="mt-2 px-5 py-2.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg hover:bg-emerald-400 transition"
          >
            Ver cardápio
          </button>
        </div>
      )}

      {cart.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl p-3.5 border border-slate-800 bg-slate-900/90 flex flex-col gap-2 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-bold text-sm text-slate-100">{item.name}</p>
              {item.notes && <p className="text-xs text-slate-400 italic mt-0.5">Obs: "{item.notes}"</p>}
              <p className="text-sm font-extrabold text-emerald-400 mt-1">
                {(item.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="px-2 py-0.5 text-slate-400 hover:text-white font-bold"
                >
                  −
                </button>
                <span className="w-5 text-center text-xs font-bold text-slate-200">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="px-2 py-0.5 text-slate-400 hover:text-white font-bold"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, 0)}
                className="text-slate-500 hover:text-red-400 p-1 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {cart.length > 0 && (
        <>
          <div className="rounded-2xl p-4 border border-slate-800 bg-slate-900 flex flex-col gap-2.5 shadow-lg mt-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Subtotal dos itens</span>
              <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Atendimento na mesa</span>
              <span className="text-emerald-400 font-bold">Grátis</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex items-center justify-between">
              <span className="font-bold text-base text-slate-100">Total do pedido</span>
              <span className="text-xl font-black text-emerald-400">
                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={placing}
            className="w-full rounded-2xl bg-emerald-500 py-3.5 font-bold text-slate-950 hover:bg-emerald-400 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Fazer pedido na mesa'}
          </button>
        </>
      )}

      <div className="mt-2">
        <WaiterCallButton />
      </div>

      <button
        type="button"
        onClick={onGoToBill}
        className="w-full rounded-2xl py-3 text-xs font-bold text-slate-300 border border-slate-800 bg-slate-900 hover:bg-slate-800 transition"
      >
        Fechar ou dividir conta da mesa
      </button>

      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 p-6 border border-slate-800 text-center shadow-2xl space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400 animate-pulse" />
            <div>
              <h3 className="text-lg font-bold text-slate-100">Pedido enviado com sucesso!</h3>
              <p className="mt-1 text-xs text-slate-400">
                Seu pedido foi recebido e já está sendo preparado pela equipe na cozinha.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                onBackToMenu();
              }}
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition"
            >
              Voltar ao cardápio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
