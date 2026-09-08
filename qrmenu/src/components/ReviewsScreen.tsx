import React from 'react';
import { Star, ThumbsUp, Award, CheckCircle } from 'lucide-react';
import type { Restaurant } from '../types';

interface ReviewsScreenProps {
  restaurant: Restaurant | null;
}

const SAMPLE_REVIEWS = [
  { id: '1', author: 'Mariana S.', rating: 5, date: 'Ontem', text: 'Atendimento muito rápido! As esfihas chegaram quentinhas e saborosas. Recomendo demais!' },
  { id: '2', author: 'Carlos H.', rating: 5, date: 'Há 3 dias', text: 'Excelente qualidade. Pedimos pelo QR code da mesa e em menos de 15 minutos já fomos servidos.' },
  { id: '3', author: 'Beatriz L.', rating: 5, date: 'Há 5 dias', text: 'Combo Casal vale muito a pena, porção generosa e refrigerante gelado.' },
];

export default function ReviewsScreen({ restaurant }: ReviewsScreenProps) {
  const rating = (restaurant as any)?.rating || '4.8';
  const reviewCount = (restaurant as any)?.reviewCount || '380';

  return (
    <div className="flex flex-col gap-4 px-4 pb-20 animate-in fade-in duration-300">
      {/* Rating Summary Card */}
      <div className="rounded-2xl bg-[var(--menu-surface)] p-5 border border-white/10 flex items-center justify-between shadow-lg">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-amber-400 tracking-tight">{rating}</span>
            <span className="text-sm text-zinc-400 font-semibold">de 5.0</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-medium">{reviewCount} avaliações verificadas</p>
        </div>

        <div className="flex flex-col items-end gap-1.5 border-l border-white/10 pl-5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <Award className="h-3.5 w-3.5" />
            Selo de Excelência
          </div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-300 font-medium">
            <ThumbsUp className="h-3 w-3 text-emerald-400" />
            98% de clientes satisfeitos
          </div>
        </div>
      </div>

      {/* Highlights Badges */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-zinc-200 font-medium">Preparo ágil</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-zinc-200 font-medium">Ingredientes selecionados</span>
        </div>
      </div>

      {/* Customer Comments */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider px-1">Últimas avaliações</h3>

        {SAMPLE_REVIEWS.map((review) => (
          <div key={review.id} className="rounded-xl bg-[var(--menu-surface)] p-4 border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[var(--menu-text)]">{review.author}</span>
              <span className="text-xs text-zinc-500">{review.date}</span>
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-xs text-zinc-300 leading-normal">{review.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
