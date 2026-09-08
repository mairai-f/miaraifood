import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stepper, { Step } from '../components/Stepper';
import Particles from '../components/Particles';
import { useTableSession } from '../context/TableSessionContext';
import type { StepperAnswers } from '../types';
import RecommendationScreen from './RecommendationScreen';

const HUNGER_OPTIONS: { value: StepperAnswers['hunger']; label: string }[] = [
  { value: 'pouca', label: 'Pouca fome' },
  { value: 'moderada', label: 'Fome moderada' },
  { value: 'muita', label: 'Muita fome' },
];

const MOOD_OPTIONS: { value: StepperAnswers['mood']; label: string }[] = [
  { value: 'tranquilo', label: 'Tranquilo(a)' },
  { value: 'com-pressa', label: 'Com pressa' },
  { value: 'irritado', label: 'Irritado(a)' },
];

function OptionRow({
  options, value, onChange,
}: { options: { value: string; label: string }[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
            value === opt.value
              ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Optional 3-question stepper (hunger, mood/rush, headcount), fully skippable via a single
 * "pular" escape hatch straight to the menu. If completed, shows an AI-suggested item before
 * the menu; if skipped, goes straight to the menu with no AI call.
 */
export default function StepperScreen({ onDone }: { onDone: () => void }) {
  const { setStepperAnswers } = useTableSession();
  const [hunger, setHunger] = useState<StepperAnswers['hunger'] | null>(null);
  const [mood, setMood] = useState<StepperAnswers['mood'] | null>(null);
  const [headcount, setHeadcount] = useState(2);
  const [showRecommendation, setShowRecommendation] = useState(false);

  const skip = () => {
    setStepperAnswers(null);
    onDone();
  };

  const finish = () => {
    const answers: StepperAnswers = { hunger: hunger ?? 'moderada', mood: mood ?? 'tranquilo', headcount };
    setStepperAnswers(answers);
    setShowRecommendation(true);
  };

  if (showRecommendation) {
    return <RecommendationScreen onContinue={onDone} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050b14] p-4 text-slate-100 overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Particles
          particleColors={['#ffffff']}
          particleCount={200}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover={true}
          alphaParticles={false}
          disableRotation={false}
        />
      </div>
      <div className="relative z-10 mb-4 flex items-center justify-between">
        <p className="text-lg font-bold">Antes de pedir…</p>
        <button onClick={skip} className="text-sm font-medium text-slate-400 underline underline-offset-2 hover:text-slate-200">
          pular
        </button>
      </div>
      <div className="relative z-10 flex-1">
      <Stepper
        initialStep={1}
        onFinalStepCompleted={finish}
        backButtonText="Voltar"
        nextButtonText="Próximo"
        renderStepIndicator={undefined}
      >
        <Step>
          <p className="mb-4 text-base font-semibold">Qual seu nível de fome?</p>
          <OptionRow options={HUNGER_OPTIONS} value={hunger} onChange={(v) => setHunger(v as StepperAnswers['hunger'])} />
        </Step>
        <Step>
          <p className="mb-4 text-base font-semibold">Como você está agora?</p>
          <OptionRow options={MOOD_OPTIONS} value={mood} onChange={(v) => setMood(v as StepperAnswers['mood'])} />
        </Step>
        <Step>
          <p className="mb-4 text-base font-semibold">Quantas pessoas na mesa?</p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setHeadcount(h => Math.max(1, h - 1))}
              className="h-10 w-10 rounded-full bg-slate-800 text-lg font-bold text-slate-200"
            >
              −
            </button>
            <span className="w-10 text-center text-2xl font-bold">{headcount}</span>
            <button
              type="button"
              onClick={() => setHeadcount(h => Math.min(20, h + 1))}
              className="h-10 w-10 rounded-full bg-slate-800 text-lg font-bold text-slate-200"
            >
              +
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">Usaremos isso depois para dividir a conta.</p>
        </Step>
      </Stepper>
      </div>
    </div>
  );
}
