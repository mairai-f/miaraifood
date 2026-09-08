import React from 'react';
import { X, ChevronRight, Layers } from 'lucide-react';
import type { MenuItem } from '../types';

interface CategoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  menuItems: MenuItem[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export default function CategoryDrawer({
  isOpen,
  onClose,
  categories,
  menuItems,
  selectedCategory,
  onSelectCategory,
}: CategoryDrawerProps) {
  if (!isOpen) return null;

  // Calculate count per category
  const categoryCounts = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = menuItems.filter(item => item.category === cat).length;
    return acc;
  }, {});

  const totalCount = menuItems.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm transition-opacity">
      <div
        className="w-full max-w-md bg-[var(--menu-surface)] h-full overflow-y-auto overscroll-contain flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
        style={{ color: 'var(--menu-text)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 p-4 bg-[var(--menu-surface)]/95 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--menu-primary)]" />
            <h2 className="text-lg font-bold tracking-tight">Cardápio completo</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category List */}
        <div className="flex-1 p-4 flex flex-col gap-2">
          {/* All Categories Option */}
          <button
            onClick={() => {
              onSelectCategory('todas');
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
              selectedCategory === 'todas'
                ? 'border-[var(--menu-primary)] bg-[var(--menu-primary)]/10 text-[var(--menu-primary)] font-bold'
                : 'border-white/5 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-200'
            }`}
          >
            <span className="font-semibold text-base">Todas as categorias</span>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 font-bold">{totalCount}</span>
              <ChevronRight className="h-4 w-4 opacity-50" />
            </div>
          </button>

          {/* Individual Categories */}
          {categories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  onSelectCategory(cat);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                  isSelected
                    ? 'border-[var(--menu-primary)] bg-[var(--menu-primary)]/10 text-[var(--menu-primary)] font-bold'
                    : 'border-white/5 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300'
                }`}
              >
                <span className="font-medium text-base truncate">{cat}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 font-bold">{count}</span>
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
