import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { formatCount } from '../lib/format';
import { cn } from '../lib/cn';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Stock available: the stepper never goes above it */
  max: number;
  min?: number;
  step?: number;
  /** What is being counted, for screen readers: "Mvule seedlings" */
  label: string;
  className?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** − [ 200 ] +, with 44 px buttons; typing is allowed and clamped to the stock available. */
export const QuantityStepper = ({ value, onChange, max, min = 0, step = 1, label, className }: QuantityStepperProps) => {
  const [draft, setDraft] = useState(String(value));
  // Follow changes made from outside (e.g. a quote capped the quantity) without an extra effect pass
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setDraft(String(value));
  }

  const set = (n: number) => {
    const next = clamp(Number.isFinite(n) ? Math.round(n) : min, min, max);
    onChange(next);
    setDraft(String(next));
  };

  const button = 'flex size-11 shrink-0 items-center justify-center rounded-sm border border-field bg-paper text-forest disabled:opacity-40';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button type="button" className={button} onClick={() => { set(value - step); }} disabled={value <= min} aria-label={`Fewer ${label}`}>
        <Minus aria-hidden className="size-5" />
      </button>
      <input
        value={draft}
        onChange={e => { setDraft(e.target.value.replace(/\D/g, '')); }}
        onBlur={() => { set(draft === '' ? min : Number(draft)); }}
        onKeyDown={e => {
          if (e.key === 'Enter') set(draft === '' ? min : Number(draft));
        }}
        inputMode="numeric"
        aria-label={label}
        aria-describedby={undefined}
        className="h-11 w-20 rounded-sm border border-field bg-paper text-center text-lg font-bold"
      />
      <button type="button" className={button} onClick={() => { set(value + step); }} disabled={value >= max} aria-label={`More ${label}`}>
        <Plus aria-hidden className="size-5" />
      </button>
      <span className="text-sm text-bark-muted">max {formatCount(max)}</span>
    </div>
  );
};
