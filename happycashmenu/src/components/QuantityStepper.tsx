import { Minus, Plus } from "lucide-react";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function QuantityStepper({ value, onChange, min = 1, max = 99 }: QuantityStepperProps) {
  return (
    <div className="inline-flex h-11 items-center overflow-hidden rounded-lg border bg-card">
      <button className="grid size-11 place-items-center hover:bg-muted" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Diminuir">
        <Minus size={16} />
      </button>
      <span className="grid min-w-11 place-items-center text-sm font-black">{value}</span>
      <button className="grid size-11 place-items-center hover:bg-muted" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Aumentar">
        <Plus size={16} />
      </button>
    </div>
  );
}
