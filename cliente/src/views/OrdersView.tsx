import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Clock, ArrowRight, Loader2, Star, CheckCircle, RefreshCw, ShoppingBag } from 'lucide-react';
import { getHistory, getActiveOrder, markRated } from '../lib/storage';
import type { UserProfile, ActiveOrder, HistoryRecord, Restaurant } from '../types';

interface OrdersViewProps {
  user: UserProfile | null;
  activeOrder: ActiveOrder | null;
  onOpenTracking: () => void;
  onSelectRestaurant: (r: Restaurant) => void;
  onRequireLogin: () => void;
}

export default function OrdersView({
  user,
  activeOrder,
  onOpenTracking,
  onSelectRestaurant,
  onRequireLogin,
}: OrdersViewProps) {
  const [history, setHistory] = useState<HistoryRecord[]>(getHistory());
  const [ratedOrders, setRatedOrders] = useState<string[]>([]);

  if (user?.isGuest) {
    return (
      <div className="min-h-screen bg-[#06100A] text-white pb-28 pt-8 px-4 font-sans flex flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#16301F] text-4xl text-[#008000] mb-4">
          🛍️
        </div>
        <h2 className="text-xl font-extrabold text-white mb-2">Acompanhe seus pedidos</h2>
        <p className="text-xs text-slate-300 max-w-xs mb-6 leading-relaxed">
          Entre ou cadastre-se para ver seus pedidos anteriores, acompanhar a entrega em tempo real e acumular pontos.
        </p>
        <button
          onClick={onRequireLogin}
          className="bg-[#008000] hover:bg-[#70E000] text-[#06100A] font-extrabold text-sm px-6 py-3 rounded-full shadow-md transition"
        >
          Entrar ou Cadastrar
        </button>
      </div>
    );
  }

  const handleRate = (orderId: string) => {
    markRated(orderId);
    setRatedOrders((prev) => [...prev, orderId]);
  };

  return (
    <div className="min-h-screen bg-[#06100A] text-white pb-28 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0B1A10] text-white px-4 py-4 shadow-md border-b border-[#16301F]">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#008000]" />
            <h1 className="text-lg font-extrabold tracking-tight">Meus Pedidos</h1>
          </div>
          <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full font-bold border border-[#008000]/30">
            {history.length} {history.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {/* Active Order Card */}
        {activeOrder && (
          <div className="mb-6 bg-emerald-600 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full w-fit mb-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Em andamento</span>
              </div>
              <h3 className="text-xl font-extrabold drop-shadow-xs">{activeOrder.restaurantName}</h3>
              <p className="text-xs opacity-90 mt-1">Seu pedido está sendo preparado pela cozinha!</p>

              <button
                onClick={onOpenTracking}
                className="mt-4 bg-white text-emerald-900 hover:bg-emerald-50 font-extrabold text-xs px-5 py-2.5 rounded-full shadow-md transition flex items-center gap-1.5"
              >
                Acompanhar Entrega <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="absolute -right-6 -bottom-6 text-8xl opacity-20 pointer-events-none select-none">
              🛵
            </div>
          </div>
        )}

        {/* Orders History List */}
        <h3 className="text-sm font-extrabold uppercase text-slate-300 tracking-wider mb-3">Histórico de Pedidos</h3>

        {history.length === 0 ? (
          <div className="bg-[#16301F] border border-[#0B1A10] p-8 rounded-3xl text-center shadow-xs my-4">
            <div className="text-5xl mb-3">🧾</div>
            <h4 className="font-extrabold text-white text-base">Você ainda não fez nenhum pedido</h4>
            <p className="text-xs text-slate-300 mt-1">Explore os melhores restaurantes e faça seu primeiro pedido no MIAR!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.slice().reverse().map((record) => {
              const isRated = record.rated || ratedOrders.includes(record.id);
              const formattedDate = record.createdAt ? new Date(record.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              }) : 'Recente';

              return (
                <div key={record.id} className="bg-[#16301F] border border-[#0B1A10] p-4 rounded-2xl shadow-xs transition hover:border-[#008000]/50">
                  {/* Restaurant Header */}
                  <div className="flex items-center justify-between border-b border-[#0B1A10]/50 pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1A10] text-[#008000] font-black text-lg">
                        {record.restaurantName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm">{record.restaurantName}</h4>
                        <p className="text-[11px] text-slate-400 font-medium">{formattedDate}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full">
                      <CheckCircle className="h-3.5 w-3.5" /> Concluído
                    </span>
                  </div>

                  {/* Items list */}
                  <div className="space-y-1 mb-3">
                    {record.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-200 font-medium">
                        <span>{item.quantity}x {item.name}</span>
                        <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Total & Action Buttons */}
                  <div className="flex items-center justify-between border-t border-[#0B1A10]/50 pt-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Total</span>
                      <p className="text-sm font-extrabold text-white">R$ {record.total.toFixed(2)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isRated && (
                        <button
                          onClick={() => handleRate(record.id)}
                          className="flex items-center gap-1 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 font-bold text-xs px-3 py-1.5 rounded-full border border-amber-500/30 transition"
                        >
                          <Star className="h-3.5 w-3.5 fill-current" /> Avaliar
                        </button>
                      )}

                      <button
                        onClick={() => {
                          fetch('/api/restaurants')
                            .then((r) => r.json())
                            .then((rests: Restaurant[]) => {
                              const match = rests.find((x) => x.id === record.restaurantId || x.name === record.restaurantName);
                              if (match) onSelectRestaurant(match);
                              else if (rests.length > 0) onSelectRestaurant(rests[0]);
                            });
                        }}
                        className="flex items-center gap-1 bg-[#008000] hover:bg-[#70E000] text-[#06100A] font-extrabold text-xs px-3.5 py-1.5 rounded-full shadow-xs transition"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Repetir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
