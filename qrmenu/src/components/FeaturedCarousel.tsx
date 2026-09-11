import React from 'react';
import { Flame, Plus } from 'lucide-react';
import type { MenuItem } from '../types';

interface FeaturedCarouselProps {
  items: MenuItem[];
  onSelectItem: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
}

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';

export default function FeaturedCarousel({ items, onSelectItem, onQuickAdd }: FeaturedCarouselProps) {
  if (!items.length) return null;

  return (
    <div className="w-full mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Flame className="h-5 w-5 text-amber-500 fill-amber-500 animate-bounce" />
        <h2 className="text-base font-extrabold tracking-tight" style={{ color: 'var(--menu-text)' }}>
          Destaques & Mais Pedidos
        </h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory touch-pan-x scroll-smooth select-none cursor-grab active:cursor-grabbing">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectItem(item)}
            className="flex-none w-44 snap-start rounded-2xl bg-[var(--menu-surface)] border border-white/10 overflow-hidden cursor-pointer group hover:border-[var(--menu-primary)] transition-all shadow-md"
          >
            <div className="relative h-28 w-full overflow-hidden bg-zinc-800">
              <img
                src={item.imageUrl?.trim() || PLACEHOLDER_IMG}
                alt={item.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
              />
              <span className="absolute top-2 left-2 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                Destaque
              </span>
            </div>

            <div className="p-3 flex flex-col justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm line-clamp-1" style={{ color: 'var(--menu-text)' }}>
                  {item.name}
                </h3>
                {item.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-black text-[var(--menu-primary)]">
                  {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd(item);
                  }}
                  className="h-7 w-7 rounded-xl bg-[var(--menu-primary)] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
