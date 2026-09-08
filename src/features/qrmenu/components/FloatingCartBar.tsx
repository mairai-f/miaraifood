import { ShoppingBag, ArrowRight } from 'lucide-react';
import type { CartItem } from '../types';

interface FloatingCartBarProps {
  cart: CartItem[];
  tableName?: string | null;
  onOpenCart: () => void;
}

export default function FloatingCartBar({ cart, tableName, onOpenCart }: FloatingCartBarProps) {
  const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cart.reduce((acc, item) => acc + item.quantity * item.price, 0);

  if (!totalCount) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-4 pointer-events-none">
      <div
        onClick={onOpenCart}
        className="pointer-events-auto mx-auto max-w-md w-full flex items-center justify-between rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl border border-emerald-400/30 cursor-pointer transition-transform active:scale-[0.98] bg-emerald-600 text-white"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-emerald-900 shadow-md">
              {totalCount}
            </span>
          </div>
          <div>
            <p className="text-xs opacity-90 font-medium">
              {tableName ? `Mesa ${tableName}` : 'Sua sacola'}
            </p>
            <p className="text-lg font-black tracking-tight">
              {totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-bold text-sm bg-black/20 hover:bg-black/30 px-3.5 py-2 rounded-xl border border-white/10">
          <span>Ver sacola</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
