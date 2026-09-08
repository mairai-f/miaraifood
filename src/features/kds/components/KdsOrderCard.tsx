import { useState, useEffect } from 'react';
import { ChefHat, Check, Clock, User, QrCode } from 'lucide-react';
import type { KdsOrder, KdsOrderStatus } from '../types';

interface KdsOrderCardProps {
  order: KdsOrder;
  onUpdateStatus: (orderId: string, status: KdsOrderStatus) => Promise<any>;
}

export default function KdsOrderCard({ order, onUpdateStatus }: KdsOrderCardProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const calc = () => {
      const start = new Date(order.createdAt).getTime();
      const now = Date.now();
      setElapsedMinutes(Math.max(0, Math.floor((now - start) / 60000)));
    };
    calc();
    const interval = setInterval(calc, 10000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  const isDelayed = elapsedMinutes >= 20 && order.status !== 'ready';

  const handleNextStatus = async () => {
    if (updating) return;
    setUpdating(true);
    let next: KdsOrderStatus = 'preparing';
    if (order.status === 'submitted') next = 'preparing';
    else if (order.status === 'preparing') next = 'ready';
    else if (order.status === 'ready') next = 'delivered';

    await onUpdateStatus(order.id, next);
    setUpdating(false);
  };

  return (
    <div
      className={`rounded-2xl border bg-card p-4 shadow-xl flex flex-col justify-between transition ${
        isDelayed
          ? 'border-rose-500/80 shadow-rose-500/10'
          : order.status === 'ready'
          ? 'border-[#70E000]/80 shadow-[#70E000]/20'
          : 'border-white/10'
      }`}
    >
      <div>
        <div className="flex items-start justify-between border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-white">{order.tableCode}</span>
              {order.source === 'qrmenu' ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#70E000] bg-[#70E000]/10 border border-[#70E000]/30 px-2 py-0.5 rounded-full">
                  <QrCode className="h-3 w-3" /> QR Menu
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400 bg-sky-400/10 border border-sky-400/30 px-2 py-0.5 rounded-full">
                  <User className="h-3 w-3" /> Garçom
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">Pedido #{order.id.slice(0, 8)}</p>
          </div>

          <div
            className={`flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded-lg ${
              isDelayed
                ? 'bg-rose-500/20 text-rose-300 animate-pulse'
                : 'bg-white/10 text-zinc-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{elapsedMinutes} min</span>
          </div>
        </div>

        <div className="py-3 space-y-2 max-h-60 overflow-y-auto">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">
                  <span className="text-[#70E000] mr-1.5 font-black">{item.quantity}x</span>
                  {item.productName}
                </p>
                {item.notes && (
                  <p className="text-xs text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded mt-1 font-medium italic border border-amber-500/20">
                    Obs: {item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-white/10">
        {order.status === 'submitted' && (
          <button
            type="button"
            onClick={handleNextStatus}
            disabled={updating}
            className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-black hover:bg-amber-400 transition flex items-center justify-center gap-1.5 shadow-md"
          >
            <ChefHat className="h-4 w-4" /> Iniciar Preparo
          </button>
        )}

        {order.status === 'preparing' && (
          <button
            type="button"
            onClick={handleNextStatus}
            disabled={updating}
            className="w-full rounded-xl bg-[#70E000] hover:bg-[#9EF01A] py-2.5 text-xs font-extrabold text-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-[#70E000]/20"
          >
            <Check className="h-4 w-4" /> Marcar como Pronto!
          </button>
        )}

        {order.status === 'ready' && (
          <button
            type="button"
            onClick={handleNextStatus}
            disabled={updating}
            className="w-full rounded-xl bg-white/10 py-2 text-xs font-bold text-zinc-200 hover:bg-white/20 transition"
          >
            Marcar Entregue à Mesa
          </button>
        )}
      </div>
    </div>
  );
}
