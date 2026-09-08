import { ChefHat, RefreshCw, Volume2, VolumeX, Maximize2, QrCode, User, Layers } from 'lucide-react';
import type { KdsOrder } from '../types';

interface KdsHeaderProps {
  orders: KdsOrder[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRefresh: () => void;
  sourceFilter: 'all' | 'qrmenu' | 'waiter';
  onSourceFilterChange: (filter: 'all' | 'qrmenu' | 'waiter') => void;
}

export default function KdsHeader({
  orders,
  soundEnabled,
  onToggleSound,
  onRefresh,
  sourceFilter,
  onSourceFilterChange,
}: KdsHeaderProps) {
  const submittedCount = orders.filter((o) => o.status === 'submitted').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      void document.exitFullscreen();
    }
  };

  return (
    <header className="bg-background/90 backdrop-blur-md border-b border-border/30 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-[#70E000]/10 border border-[#70E000]/30 text-[#70E000]">
          <ChefHat className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            KDS Cozinha <span className="text-xs px-2 py-0.5 rounded-full bg-[#70E000]/15 text-[#70E000] border border-[#70E000]/30 font-bold">Ao Vivo</span>
          </h1>
          <p className="text-xs text-zinc-400">Gerenciamento de pedidos em tempo real (Cliente & Garçom)</p>
        </div>
      </div>

      {/* Metrics Badges */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-card border border-white/10 px-3 py-1.5 rounded-xl">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-medium text-zinc-300">Aguardando:</span>
          <span className="text-sm font-black text-amber-400">{submittedCount}</span>
        </div>

        <div className="flex items-center gap-2 bg-card border border-white/10 px-3 py-1.5 rounded-xl">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-xs font-medium text-zinc-300">Em Preparo:</span>
          <span className="text-sm font-black text-sky-400">{preparingCount}</span>
        </div>

        <div className="flex items-center gap-2 bg-card border border-white/10 px-3 py-1.5 rounded-xl">
          <span className="h-2 w-2 rounded-full bg-[#70E000]" />
          <span className="text-xs font-medium text-zinc-300">Prontos:</span>
          <span className="text-sm font-black text-[#70E000]">{readyCount}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Source Filter */}
        <div className="flex items-center bg-card border border-white/10 p-1 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => onSourceFilterChange('all')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
              sourceFilter === 'all'
                ? 'bg-[#70E000] text-black font-extrabold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Todos
          </button>

          <button
            type="button"
            onClick={() => onSourceFilterChange('qrmenu')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
              sourceFilter === 'qrmenu'
                ? 'bg-[#70E000] text-black font-extrabold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" /> QR Menu
          </button>

          <button
            type="button"
            onClick={() => onSourceFilterChange('waiter')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
              sourceFilter === 'waiter'
                ? 'bg-sky-400 text-black font-extrabold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <User className="h-3.5 w-3.5" /> Garçom
          </button>
        </div>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          title={soundEnabled ? 'Silenciar Alertas' : 'Ativar Alertas Sonoros'}
          className={`p-2.5 rounded-xl border transition ${
            soundEnabled
              ? 'bg-[#70E000]/10 border-[#70E000]/30 text-[#70E000] hover:bg-[#70E000]/20'
              : 'bg-card border-white/10 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          title="Atualizar Pedidos"
          className="p-2.5 rounded-xl bg-card border border-white/10 text-zinc-300 hover:bg-white/10 transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title="Modo Tela Cheia"
          className="p-2.5 rounded-xl bg-card border border-white/10 text-zinc-300 hover:bg-white/10 transition"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
