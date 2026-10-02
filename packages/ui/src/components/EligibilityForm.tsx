import { checkEligibility, type EligibilityAnswers, type EligibilityRule } from '@nurserylink/shared';
import { Gift } from 'lucide-react';
import { useForm, type FieldErrors, type Resolver, type ResolverResult } from 'react-hook-form';
import { formatCount } from '../lib/format';
import { Button } from './Button';
import { Field, Input } from './Field';

/** Wording, so each app keeps its copy in its own copy file (English defaults). */
export interface EligibilityFormLabels {
  required: string;
  yes: string;
  quantityLabel: string;
  quantityHint: (max: string) => string;
  quantityInvalid: (max: string) => string;
  apply: string;
}

export const defaultEligibilityLabels: EligibilityFormLabels = {
  required: 'required',
  yes: 'Yes, this is true for me',
  quantityLabel: 'How many seedlings do you need?',
  quantityHint: max => `Up to ${max}. Ask only for what you can plant and care for.`,
  quantityInvalid: max => `Enter a number from 1 to ${max}.`,
  apply: 'Apply for free seedlings',
};

/** Raw form values: checkboxes are booleans, everything typed is text until validated. */
interface FormValues {
  answers: Record<string, boolean | string>;
  quantity: string;
}

export interface EligibilityApplication {
  answers: EligibilityAnswers;
  quantity_requested: number;
}

/** Turns typed values into the API's answer types: numbers for number questions. */
const toAnswers = (rules: EligibilityRule[], raw: FormValues['answers']): EligibilityAnswers => {
  const answers: EligibilityAnswers = {};
  for (const rule of rules) {
    const v = raw[rule.key];
    if (rule.type === 'boolean') answers[rule.key] = v === true;
    else if (typeof v === 'string' && v.trim() !== '') {
      if (rule.type === 'number') {
        const n = Number(v.replace(/,/g, ''));
        answers[rule.key] = Number.isFinite(n) ? n : v;
      } else answers[rule.key] = v;
    }
  }
  return answers;
};

/**
 * Validation through the shared checkEligibility, the same function the API runs, so the form
 * can never accept what the API would refuse (or the other way round).
 */
const eligibilityResolver = (rules: EligibilityRule[], max: number, labels: EligibilityFormLabels): Resolver<FormValues, unknown, EligibilityApplication> => (values): ResolverResult<FormValues, EligibilityApplication> => {
  const errors: FieldErrors<FormValues> = {};
  const result = checkEligibility(rules, toAnswers(rules, values.answers));
  if (!result.ok) {
    const answerErrors: Record<string, { type: string; message: string }> = {};
    for (const p of result.problems) answerErrors[p.path.replace(/^answers\./, '')] = { type: 'eligibility', message: p.message };
    errors.answers = answerErrors;
  }
  const quantity = Number(values.quantity.replace(/,/g, ''));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
    errors.quantity = { type: 'range', message: labels.quantityInvalid(formatCount(max)) };
  }
  if (Object.keys(errors).length > 0 || !result.ok) return { values: {}, errors };
  return { values: { answers: result.answers, quantity_requested: quantity }, errors: {} };
};

/**
 * The application form, generated from a campaign's eligibility rules: a yes/no question becomes
 * a checkbox, a number question a number field, a text question a text field.
 */
export const EligibilityForm = ({ rules, maxQuantity, onSubmit, busy, serverError, labels = defaultEligibilityLabels }: {
  rules: EligibilityRule[];
  maxQuantity: number;
  onSubmit: (application: EligibilityApplication) => void;
  busy: boolean;
  serverError?: string | null | undefined;
  labels?: EligibilityFormLabels;
}) => {
  const max = Math.min(maxQuantity, 100_000);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues, unknown, EligibilityApplication>({
    resolver: eligibilityResolver(rules, max, labels),
    defaultValues: { answers: Object.fromEntries(rules.map(r => [r.key, r.type === 'boolean' ? false : ''])), quantity: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const answerError = (key: string) => (errors.answers as Record<string, { message?: string } | undefined> | undefined)?.[key]?.message;

  return (
    <form noValidate onSubmit={e => { void handleSubmit(onSubmit)(e); }} className="flex flex-col gap-4">
      {serverError && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{serverError}</p>}
      {rules.map(rule => {
        const label = (
          <>
            {rule.label}
            {rule.required && <span className="font-normal text-bark-muted"> ({labels.required})</span>}
          </>
        );
        if (rule.type === 'boolean') {
          const error = answerError(rule.key);
          return (
            <fieldset key={rule.key} className="flex flex-col gap-1 rounded-lg bg-paper shadow-card p-3 ring-1 ring-line" aria-invalid={error ? true : undefined}>
              <legend className="font-bold text-bark">{label}</legend>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" className="size-6 shrink-0 accent-forest" aria-describedby={error ? `${rule.key}-error` : undefined} {...register(`answers.${rule.key}`)} />
                <span>{labels.yes}</span>
              </label>
              {error && <p id={`${rule.key}-error`} role="alert" className="text-sm font-bold text-laterite">{error}</p>}
            </fieldset>
          );
        }
        return (
          <Field key={rule.key} label={label} error={answerError(rule.key)}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} inputMode={rule.type === 'number' ? 'decimal' : 'text'} aria-describedby={describedBy} invalid={invalid} {...register(`answers.${rule.key}`)} />
            )}
          </Field>
        );
      })}
      <Field label={labels.quantityLabel} hint={labels.quantityHint(formatCount(max))} error={errors.quantity?.message}>
        {({ id, describedBy, invalid }) => <Input id={id} inputMode="numeric" aria-describedby={describedBy} invalid={invalid} {...register('quantity')} />}
      </Field>
      <Button type="submit" variant="gift" size="lg" block busy={busy}>
        <Gift aria-hidden />
        {labels.apply}
      </Button>
    </form>
  );
};
