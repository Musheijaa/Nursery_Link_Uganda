import { isApiError } from '@nurserylink/api-client';
import { mobileMoneyNetwork, toE164UgandaMobile, type MobileMoneyMethod } from '@nurserylink/shared';
import { Button, ErrorState, Field, Input, Skeleton, cn, formatCount, formatDistance, formatUGX } from '@nurserylink/ui';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { en } from '../../../copy/en';
import { MobileMoneyBadges, MobileMoneyLogo } from '../../../components/MobileMoneyBadges';
import { useCountdown } from '../../../lib/useCountdown';
import { useFeatures, usePaymentMethods, useQuote, type Quote, type QuoteInput } from '../api';
import { chosenItems, type OrderDraft } from '../draft';

export interface Change {
  inventoryId: string;
  text: string;
}

const mmss = (s: number) => `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`;

/** The price breakdown from the API, with a countdown; a fresh quote is fetched when it runs out. */
const QuoteBreakdown = ({ quote, onExpired }: { quote: Quote; onExpired: () => void }) => {
  const left = useCountdown(new Date(quote.expires_at).getTime());
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (left === 0 && fired.current !== quote.quote_token) {
      fired.current = quote.quote_token;
      onExpired();
    }
  }, [left, quote.quote_token, onExpired]);
  const d = quote.delivery;
  return (
    <section aria-labelledby="quote-heading" className="flex flex-col gap-2 rounded-lg bg-paper shadow-card p-4 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <h2 id="quote-heading" className="text-lg">{en.checkout.quoteHeading}</h2>
        <span className="text-sm text-bark-muted" aria-live="off">{en.checkout.quoteExpires(mmss(left))}</span>
      </div>
      <dl className="flex flex-col divide-y divide-line">
        {quote.items.map(i => (
          <div key={i.inventory_id} className="flex justify-between gap-3 py-2">
            <dt>{formatCount(i.quantity)} × {i.species.common_name}</dt>
            <dd className="font-bold tabular-nums">{formatUGX(i.line_total)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 py-2">
          <dt>{d.type === 'order_and_deliver' && d.distance_km !== null ? en.checkout.deliveryLine(formatDistance(d.distance_km)) : en.checkout.pickupLine}</dt>
          <dd className="font-bold tabular-nums">{d.fee > 0 ? formatUGX(d.fee) : en.checkout.free}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2 text-lg">
          <dt className="font-bold">{en.checkout.total}</dt>
          <dd className="font-bold text-canopy tabular-nums">{formatUGX(quote.grand_total)}</dd>
        </div>
      </dl>
    </section>
  );
};

const MethodTile = ({ method, selected, available, onSelect }: { method: MobileMoneyMethod; selected: boolean; available: boolean; onSelect: () => void }) => (
  <label className={cn('flex min-h-28 items-center gap-4 rounded-lg bg-paper px-4 py-4 shadow-card ring-1', !available ? 'cursor-not-allowed opacity-60 ring-line' : selected ? 'cursor-pointer ring-2 ring-forest' : 'cursor-pointer ring-line hover:ring-forest')}>
    <input type="radio" name="method" checked={selected} disabled={!available} onChange={onSelect} className="size-5 shrink-0 accent-forest" />
    <span className="flex w-36 shrink-0 justify-center">
      <MobileMoneyLogo method={method} size="xl" decorative />
    </span>
    <span className="flex flex-col gap-0.5">
      <span className="text-lg font-bold text-canopy">{en.checkout.methods[method]}</span>
      <span className="text-sm text-bark-muted">{available ? en.checkout.methodHint : en.checkout.methodUnavailable}</span>
    </span>
  </label>
);

/**
 * Step 3: quote and payment. Submitting creates the order; the buyer then approves the prompt on
 * their phone (the order page waits for that). While payments are switched off (trial), there is
 * no payment to choose: "Place order" confirms the order straight away.
 */
export const StepPay = ({ nurseryId, draft, update, changes, onPay, paying, payError, onStockConflict }: {
  nurseryId: string;
  draft: OrderDraft;
  update: (c: Partial<OrderDraft>) => void;
  changes: Change[];
  onPay: (quote: Quote, method: MobileMoneyMethod | null, payer: string | null) => void;
  paying: boolean;
  payError: string | null;
  /** The quote found less stock than chosen: the checkout caps the quantities and explains */
  onStockConflict: (details: unknown) => void;
}) => {
  const input: QuoteInput = useMemo(
    () => ({ nurseryId, items: chosenItems(draft), deliveryType: draft.deliveryType, point: draft.deliveryType === 'order_and_deliver' ? draft.point : null }),
    [nurseryId, draft]
  );
  const quote = useQuote(input, input.items.length > 0);
  const methods = usePaymentMethods();
  const features = useFeatures();
  const payments = features.data?.payments;
  const [errors, setErrors] = useState<{ method?: string; payer?: string }>({});
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    if (isApiError(quote.error) && quote.error.status === 409 && Array.isArray(quote.error.details)) onStockConflict(quote.error.details);
  }, [quote.error, onStockConflict]);

  const quoteError = (() => {
    const e = quote.error;
    if (!e) return null;
    if (isApiError(e) && e.code === 'validation_error') {
      const reason = (e.details as { reason?: string } | undefined)?.reason;
      if (reason === 'too_far') return en.checkout.tooFar;
      if (reason === 'too_many_items') return en.checkout.tooMany;
    }
    return isApiError(e) ? e.message : en.checkout.quoteFailed;
  })();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (payments === false) {
      if (quote.data) onPay(quote.data, null, null);
      return;
    }
    const next: typeof errors = {};
    const payer = toE164UgandaMobile(draft.payer);
    if (!draft.method) next.method = en.checkout.chooseMethod;
    if (!payer) next.payer = 'Enter a Ugandan mobile number, e.g. 0772 123 456';
    const network = payer ? mobileMoneyNetwork(payer) : null;
    if (payer && draft.method && network && network !== draft.method) next.payer = en.checkout.wrongNetwork(en.checkout.methods[network]);
    setErrors(next);
    if (next.method || next.payer || !quote.data || !draft.method || !payer) return;
    onPay(quote.data, draft.method, payer);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {changes.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 rounded-md bg-amber-tint px-4 py-3 text-amber ring-1 ring-amber">
          <p className="font-bold">{en.checkout.changedTitle}</p>
          <ul className="list-disc pl-5">{changes.map(c => <li key={c.inventoryId}>{c.text}</li>)}</ul>
          <p>{en.checkout.requoted}</p>
        </div>
      )}
      {refreshed && <p role="status" className="text-sm text-bark-muted">{en.checkout.quoteRefreshed}</p>}

      {quote.isPending && <div role="status" aria-label={en.checkout.quoteLoading}><Skeleton className="h-48 rounded-md" /></div>}
      {quoteError && !quote.isFetching && <ErrorState title={quoteError} onRetry={() => { void quote.refetch(); }} retryLabel={en.states.retry} />}
      {quote.data && !quoteError && (
        <QuoteBreakdown
          quote={quote.data}
          onExpired={() => {
            setRefreshed(true);
            void quote.refetch();
          }}
        />
      )}

      {payments === undefined && <Skeleton className="h-32 rounded-md" />}
      {payments === false && (
        <section aria-labelledby="trial-heading" className="flex flex-col gap-1 rounded-lg bg-sky-tint px-4 py-3 ring-1 ring-sky">
          <h2 id="trial-heading" className="text-lg text-lake">{en.checkout.trialHeading}</h2>
          <p className="text-bark">{en.checkout.trialNote}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-lake">{en.payments.comingSoon}</span>
            <MobileMoneyBadges size="md" />
          </div>
        </section>
      )}
      {payments === true && (<>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">{en.checkout.payWith}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['mtn_momo', 'airtel_money'] as const).map(m => (
            <MethodTile key={m} method={m} selected={draft.method === m} available={methods.data?.[m] ?? true} onSelect={() => { update({ method: m }); }} />
          ))}
        </div>
        {errors.method && <p role="alert" className="text-sm font-bold text-laterite">{errors.method}</p>}
      </fieldset>

      <Field label={en.checkout.payerLabel} hint={en.checkout.payerHint} error={errors.payer}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} type="tel" inputMode="tel" autoComplete="tel" value={draft.payer} onChange={e => { update({ payer: e.target.value }); }} aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>
      </>)}

      {payError && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{payError}</p>}
      <Button type="submit" size="lg" block busy={paying || quote.isFetching} disabled={!quote.data || Boolean(quoteError) || payments === undefined}>
        {(payments === false ? en.checkout.placeOrder : en.checkout.pay)(quote.data ? formatUGX(quote.data.grand_total) : '…')}
      </Button>
    </form>
  );
};
