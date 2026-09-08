import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTableSession } from '../context/TableSessionContext';
import type { Recommendation } from '../types';

/** Calls the AI recommendation endpoint (Groq→Gemini fallback) once, using the stepper answers. */
export default function RecommendationScreen({ onContinue }: { onContinue: () => void }) {
  const { restaurantId, stepperAnswers } = useTableSession();
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  useEffect(() => {
    if (!restaurantId || !stepperAnswers) { setLoading(false); return; }
    let cancelled = false;
    fetch('/api/qrmenu/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, ...stepperAnswers }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: Recommendation | null) => { if (!cancelled) setRecommendation(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [restaurantId, stepperAnswers]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050b14] p-6 text-center text-slate-100">
      <Sparkles className="mb-4 h-10 w-10 text-emerald-400" />
      {loading && (
        <>
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-400">Pensando no que combina com você…</p>
        </>
      )}
      {!loading && recommendation?.itemName && (
        <>
          <p className="text-sm uppercase tracking-widest text-emerald-400">Sugestão pra você</p>
          <p className="mt-2 text-2xl font-bold">{recommendation.itemName}</p>
          <p className="mt-3 max-w-xs text-sm text-slate-400">{recommendation.reasoning}</p>
        </>
      )}
      {!loading && !recommendation?.itemName && (
        <p className="text-sm text-slate-400">Sem sugestão no momento — dá uma olhada no cardápio completo.</p>
      )}
      <button
        onClick={onContinue}
        className="mt-8 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-[#0d1b1a] transition hover:bg-emerald-400"
      >
        Ver cardápio →
      </button>
    </div>
  );
}
