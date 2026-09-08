import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTableSession } from '../context/TableSessionContext';
import type { Recommendation } from '../types';

export default function RecommendationScreen({ onContinue }: { onContinue: () => void }) {
  const { products, stepperAnswers } = useTableSession();
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (products.length > 0) {
        const featured = products.find((p) => p.featured) || products[0];
        setRecommendation({
          itemName: featured.name,
          reasoning: `Perfeito para o seu grupo de ${stepperAnswers?.headcount || 2} pessoa(s) e momento ${stepperAnswers?.mood || 'tranquilo'}.`,
        });
      }
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [products, stepperAnswers]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050b14] p-6 text-center text-slate-100">
      <Sparkles className="mb-4 h-10 w-10 text-emerald-400 animate-pulse" />
      {loading && (
        <>
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-400">Pensando no que combina com você…</p>
        </>
      )}
      {!loading && recommendation?.itemName && (
        <>
          <p className="text-sm uppercase tracking-widest text-emerald-400 font-bold">Sugestão pra você</p>
          <p className="mt-2 text-2xl font-bold">{recommendation.itemName}</p>
          <p className="mt-3 max-w-xs text-sm text-slate-400">{recommendation.reasoning}</p>
        </>
      )}
      {!loading && !recommendation?.itemName && (
        <p className="text-sm text-slate-400">Dê uma olhada no nosso cardápio completo.</p>
      )}
      <button
        type="button"
        onClick={onContinue}
        className="mt-8 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-[#0d1b1a] transition hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
      >
        Ver cardápio completo →
      </button>
    </div>
  );
}
