import { Button, Field, Input, Skeleton, cn } from '@nurserylink/ui';
import { LocateFixed, Store, Truck } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';
import { en } from '../../../copy/en';
import type { LatLng } from '../../../lib/geo';
import { useAskLocation } from '../../nurseries/LocationDialog';
import type { OrderDraft } from '../draft';

const DeliveryPicker = lazy(() => import('./DeliveryPicker'));

export interface DeliveryErrors {
  point?: string | undefined;
  address?: string | undefined;
}

const Option = ({ selected, onSelect, icon, title, hint }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; hint: string }) => (
  <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg bg-paper shadow-card p-4 ring-1', selected ? 'ring-2 ring-forest' : 'ring-line hover:ring-forest')}>
    <input type="radio" name="delivery" checked={selected} onChange={onSelect} className="mt-1 size-5 shrink-0 accent-forest" />
    <span className="mt-0.5 shrink-0 text-forest [&_svg]:size-6">{icon}</span>
    <span className="flex flex-col">
      <span className="font-bold text-canopy">{title}</span>
      <span className="text-sm text-bark-muted">{hint}</span>
    </span>
  </label>
);

/** Step 2: delivery to a pin on the map (with an address a rider can follow), or collection. */
export const StepDelivery = ({ draft, update, nursery, errors }: {
  draft: OrderDraft;
  update: (c: Partial<OrderDraft>) => void;
  nursery: { name: string; location: LatLng };
  errors: DeliveryErrors;
}) => {
  const { ask, dialog, finding } = useAskLocation();
  const deliver = draft.deliveryType === 'order_and_deliver';
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl">{en.checkout.deliveryHeading}</h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{en.checkout.deliveryHeading}</legend>
        <Option selected={deliver} onSelect={() => { update({ deliveryType: 'order_and_deliver' }); }} icon={<Truck aria-hidden />} title={en.checkout.deliver} hint={en.checkout.deliverHint} />
        <Option selected={!deliver} onSelect={() => { update({ deliveryType: 'self_pickup' }); }} icon={<Store aria-hidden />} title={en.checkout.collect} hint={en.checkout.collectHint} />
      </fieldset>

      {deliver ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-bold">{en.checkout.pinLabel}</p>
            <p className="text-sm text-bark-muted">{en.checkout.pinHelp}</p>
          </div>
          <Button variant="secondary" className="self-start" busy={finding} onClick={() => { ask(p => { update({ point: p }); }); }}>
            <LocateFixed aria-hidden />
            {en.checkout.useMyLocation}
          </Button>
          <Suspense fallback={<Skeleton className="h-64 rounded-md md:h-80" />}>
            <DeliveryPicker point={draft.point} nursery={nursery.location} onPick={p => { update({ point: p }); }} label={en.checkout.pinLabel} />
          </Suspense>
          {errors.point && <p role="alert" className="text-sm font-bold text-laterite">{errors.point}</p>}
          <Field label={en.checkout.addressLabel} hint={en.checkout.addressHint} error={errors.address}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} value={draft.address} onChange={e => { update({ address: e.target.value }); }} autoComplete="street-address" aria-describedby={describedBy} invalid={invalid} maxLength={300} />
            )}
          </Field>
        </div>
      ) : (
        <p className="rounded-md bg-forest-tint px-4 py-3 text-forest">{en.checkout.collectFrom(nursery.name)}</p>
      )}
      {dialog}
    </div>
  );
};
