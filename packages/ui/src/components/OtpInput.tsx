import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  /** Accessible name for the group, e.g. "Verification code" */
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Called once all digits are entered */
  onComplete?: (value: string) => void;
}

/**
 * Six separate boxes for an SMS code. Typing advances, Backspace goes back, and pasting or the
 * phone's SMS autofill (autocomplete="one-time-code" on the first box) fills them all at once.
 */
export const OtpInput = ({ value, onChange, length = 6, label, invalid, disabled, autoFocus, onComplete }: OtpInputProps) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  // On a screen whose only job is entering the code, start in the first box
  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const commit = (next: string, focusAt: number) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    focus(focusAt);
    if (clean.length === length) onComplete?.(clean);
  };

  const onInput = (i: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;
    // More than one digit arrives when the phone autofills the code into one box
    if (typed.length > 1) {
      commit(typed, typed.length);
      return;
    }
    const next = digits.slice();
    next[i] = typed;
    commit(next.join(''), i + 1);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = digits.slice();
      if (next[i]) next[i] = '';
      else if (i > 0) next[i - 1] = '';
      onChange(next.join('').slice(0, length));
      if (!digits[i]) focus(i - 1);
    } else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'ArrowRight') focus(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    commit(e.clipboardData.getData('text'), length - 1);
  };

  return (
    <div role="group" aria-label={label} className="flex w-full max-w-sm gap-1.5 sm:gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          value={d}
          onChange={e => { onInput(i, e.target.value); }}
          onKeyDown={e => { onKeyDown(i, e); }}
          onPaste={onPaste}
          onFocus={e => { e.target.select(); }}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          disabled={disabled}
          aria-label={`Digit ${String(i + 1)} of ${String(length)}`}
          aria-invalid={invalid || undefined}
          maxLength={i === 0 ? length : 1}
          className={cn(
            // Boxes share the row so six always fit on a 320 px phone; never shorter than a 44 px target
            'h-12 min-w-0 flex-1 rounded-sm border border-field bg-paper text-center text-xl font-bold text-canopy sm:h-14',
            invalid && 'border-laterite bg-laterite-tint/40'
          )}
        />
      ))}
    </div>
  );
};
