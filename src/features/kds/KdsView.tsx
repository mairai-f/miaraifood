import { useState, useMemo, useEffect, useRef } from 'react';
import { ChefHat, AlertCircle, Loader2 } from 'lucide-react';
import { useKdsOrders } from './hooks/useKdsOrders';
import KdsHeader from './components/KdsHeader';
import KdsOrderCard from './components/KdsOrderCard';
import type { KdsOrder } from './types';

export default function KdsView() {
  const { orders, loading, error, refresh, updateOrderStatus } = useKdsOrders();
  const [sourceFilter, setSourceFilter] = useState<'all' | 'qrmenu' | 'waiter'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousSubmittedCountRef = useRef(0);

  const filteredOrders = useMemo(() => {
    if (sourceFilter === 'all') return orders;
    return orders.filter((o) => o.source === sourceFilter);
  }, [orders, sourceFilter]);

  const submittedOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'submitted'),
    [filteredOrders]
  );
  const preparingOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'preparing'),
    [filteredOrders]
  );
  const readyOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'ready'),
    [filteredOrders]
  );

  // Play audio alert when a new order arrives in submitted state
  useEffect(() => {
    if (soundEnabled && submittedOrders.length > previousSubmittedCountRef.current) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5 note
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch (err) {
        console.warn('Audio alert error:', err);
      }
    }
    previousSubmittedCountRef.current = submittedOrders.length;
  }, [submittedOrders.length, soundEnabled]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[600px] items-center justify-center bg-[#050b14] text-zinc-400">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#70E000]" />
          <span className="text-sm font-medium">Carregando tela da cozinha (KDS)...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[600px] items-center justify-center bg-[#050b14] text-zinc-300">
        <div className="text-center max-w-md p-6 bg-[#0c192c] border border-[#006400]/30 rounded-2xl">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">Erro no KDS</h2>
          <p className="text-sm text-zinc-400 mt-1 mb-4">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="px-4 py-2 bg-[#70E000] text-black font-extrabold text-xs rounded-xl hover:bg-[#9EF01A] transition"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#050b14] text-white font-sans">
      <KdsHeader
        orders={orders}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onRefresh={refresh}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
      />

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start overflow-x-auto">
        {/* Column 1: Aguardando */}
        <section className="bg-[#0c192c]/80 border border-[#006400]/30 rounded-2xl p-4 flex flex-col min-h-[500px] shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-base font-black text-amber-400 tracking-wide uppercase">
                Aguardando ({submittedOrders.length})
              </h2>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">Novos Pedidos</span>
          </div>

          <div className="space-y-4 flex-1">
            {submittedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center">
                <ChefHat className="h-10 w-10 mb-2 stroke-1 opacity-50 text-[#70E000]" />
                <p className="text-xs font-medium">Nenhum pedido pendente</p>
              </div>
            ) : (
              submittedOrders.map((order) => (
                <KdsOrderCard key={order.id} order={order} onUpdateStatus={updateOrderStatus} />
              ))
            )}
          </div>
        </section>

        {/* Column 2: Em Preparo */}
        <section className="bg-[#0c192c]/80 border border-[#006400]/30 rounded-2xl p-4 flex flex-col min-h-[500px] shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-sky-400 animate-pulse" />
              <h2 className="text-base font-black text-sky-400 tracking-wide uppercase">
                Em Preparo ({preparingOrders.length})
              </h2>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">Na Cozinha</span>
          </div>

          <div className="space-y-4 flex-1">
            {preparingOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center">
                <ChefHat className="h-10 w-10 mb-2 stroke-1 opacity-50 text-sky-400" />
                <p className="text-xs font-medium">Nenhum pedido em preparo</p>
              </div>
            ) : (
              preparingOrders.map((order) => (
                <KdsOrderCard key={order.id} order={order} onUpdateStatus={updateOrderStatus} />
              ))
            )}
          </div>
        </section>

        {/* Column 3: Prontos */}
        <section className="bg-[#0c192c]/80 border border-[#006400]/30 rounded-2xl p-4 flex flex-col min-h-[500px] shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#70E000]" />
              <h2 className="text-base font-black text-[#70E000] tracking-wide uppercase">
                Prontos ({readyOrders.length})
              </h2>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">Para Servir</span>
          </div>

          <div className="space-y-4 flex-1">
            {readyOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center">
                <ChefHat className="h-10 w-10 mb-2 stroke-1 opacity-50 text-[#70E000]" />
                <p className="text-xs font-medium">Nenhum pedido pronto no momento</p>
              </div>
            ) : (
              readyOrders.map((order) => (
                <KdsOrderCard key={order.id} order={order} onUpdateStatus={updateOrderStatus} />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
