import { Minus, Plus } from "lucide-react";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function QuantityStepper({ value, onChange, min = 1, max = 99 }: QuantityStepperProps) {
  return (
    <div className="inline-flex h-12 items-center overflow-hidden rounded-full border border-white/70 bg-card shadow-[0_12px_26px_rgba(53,35,16,0.08)]">
      <button className="grid size-12 place-items-center transition hover:bg-[#fff4ea]" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Diminuir">
        <Minus size={16} />
      </button>
      <span className="grid min-w-12 place-items-center text-sm font-extrabold">{value}</span>
      <button className="grid size-12 place-items-center transition hover:bg-[#fff4ea]" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Aumentar">
        <Plus size={16} />
      </button>
    </div>
  );
}
