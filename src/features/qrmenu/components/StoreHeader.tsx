import React from 'react';
import { Star, Clock, Award, CheckCircle2 } from 'lucide-react';

interface StoreHeaderProps {
  establishmentName: string;
  tableName?: string | null;
  activeTab: 'menu' | 'reviews' | 'info';
  onTabChange: (tab: 'menu' | 'reviews' | 'info') => void;
  coverUrl?: string;
  logoUrl?: string;
}

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80';
const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80';

export default function StoreHeader({
  establishmentName,
  tableName,
  activeTab,
  onTabChange,
  coverUrl,
  logoUrl,
}: StoreHeaderProps) {
  const storeName = establishmentName || 'Miaifood QR Menu';
  const bannerImg = coverUrl || localStorage.getItem('qrmenu_cover_url') || DEFAULT_COVER;
  const avatarImg = logoUrl || localStorage.getItem('qrmenu_logo_url') || DEFAULT_LOGO;

  return (
    <div className="w-full bg-[var(--menu-surface)] border-b border-white/10 mb-3 shadow-md">
      <div className="relative h-36 sm:h-48 w-full overflow-hidden bg-zinc-900">
        <img
          src={bannerImg}
          alt={storeName}
          className="h-full w-full object-cover brightness-90 transition-transform duration-500 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {tableName && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-white shadow-lg border border-emerald-400/40">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            {tableName}
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-white shadow-md border border-emerald-400/30">
          <Award className="h-3.5 w-3.5" />
          Miaifood Parceiro
        </div>
      </div>

      <div className="px-4 pb-3 relative -mt-10 flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <div className="relative h-20 w-20 rounded-2xl overflow-hidden border-3 border-[var(--menu-surface)] bg-zinc-800 shadow-xl">
            <img src={avatarImg} alt={storeName} className="h-full w-full object-cover" />
          </div>

          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">4.9</span>
            <span className="text-xs text-zinc-400">(420+)</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: 'var(--menu-text)' }}>
              {storeName}
            </h1>
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2 font-medium">
            <span>Gastronomia</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Clock className="h-3.5 w-3.5" />
              Atendimento na mesa
            </span>
          </p>
        </div>

        <div className="flex border-t border-white/10 pt-2 mt-1 gap-6">
          <button
            type="button"
            onClick={() => onTabChange('menu')}
            className={`pb-2 text-sm font-bold transition-all relative ${
              activeTab === 'menu'
                ? 'text-[var(--menu-primary)] font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Cardápio
            {activeTab === 'menu' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--menu-primary)] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('reviews')}
            className={`pb-2 text-sm font-bold transition-all relative ${
              activeTab === 'reviews'
                ? 'text-[var(--menu-primary)] font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Avaliações
            {activeTab === 'reviews' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--menu-primary)] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('info')}
            className={`pb-2 text-sm font-bold transition-all relative ${
              activeTab === 'info'
                ? 'text-[var(--menu-primary)] font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Informações
            {activeTab === 'info' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--menu-primary)] rounded-full" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
