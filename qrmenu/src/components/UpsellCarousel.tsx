import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import type { MenuItem } from '../types';

interface UpsellCarouselProps {
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
}

const DEFAULT_BEVERAGE_IMG = 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80';

export default function UpsellCarousel({ items, onAdd }: UpsellCarouselProps) {
  if (!items.length) return null;

  return (
    <div className="w-full my-2 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-1">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <h3 className="font-extrabold text-sm text-[var(--menu-text)] tracking-tight">Peça também (Sugestões)</h3>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory touch-pan-x scroll-smooth select-none cursor-grab active:cursor-grabbing">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex-none w-36 snap-start rounded-xl bg-zinc-900/90 border border-white/10 overflow-hidden flex flex-col justify-between p-2.5 shadow"
          >
            <div className="relative h-20 w-full rounded-lg overflow-hidden mb-2 bg-zinc-800">
              <img
                src={item.imageUrl?.trim() || DEFAULT_BEVERAGE_IMG}
                alt={item.name}
                className="h-full w-full object-cover pointer-events-none"
              />
            </div>
            <div>
              <p className="font-bold text-xs line-clamp-1 text-white">{item.name}</p>
              <p className="text-xs font-black text-[var(--menu-primary)] mt-0.5">
                {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <button
              onClick={() => onAdd(item)}
              className="mt-2 w-full py-1.5 rounded-lg bg-[var(--menu-primary)] text-white font-bold text-xs flex items-center justify-center gap-1 hover:opacity-90 active:scale-95 transition-all shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
