import type { Schemas } from '@nurserylink/api-client';
import { QuantityStepper, formatUGX } from '@nurserylink/ui';
import { en } from '../../../copy/en';
import type { OrderDraft } from '../draft';

type Item = Schemas['NurseryProfile']['inventory'][number];

/** Step 1: how many of each tree, never more than the nursery has (steppers are capped at stock). */
export const StepSeedlings = ({ inventory, draft, onChange, error }: {
  inventory: Item[];
  draft: OrderDraft;
  onChange: (quantities: Record<string, number>) => void;
  error: string | null;
}) => {
  const subtotal = inventory.reduce((sum, i) => sum + (draft.quantities[i.inventory_id] ?? 0) * i.unit_price, 0);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl">{en.checkout.seedlingsHeading}</h2>
      {error && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{error}</p>}
      <ul className="flex flex-col divide-y divide-line rounded-lg bg-paper shadow-card px-4 ring-1 ring-line">
        {inventory.map(item => (
          <li key={item.inventory_id} className="flex flex-col gap-2 py-4">
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-bold text-canopy">
                {item.species.common_name}
              </span>
              <span className="text-sm">
                <span className="font-bold">{formatUGX(item.unit_price)}</span> <span className="text-bark-muted">{en.checkout.each}</span>
              </span>
            </span>
            <QuantityStepper
              label={`${item.species.common_name} seedlings`}
              value={draft.quantities[item.inventory_id] ?? 0}
              max={item.quantity_available}
              onChange={q => { onChange({ ...draft.quantities, [item.inventory_id]: q }); }}
            />
          </li>
        ))}
      </ul>
      <p className="flex justify-between text-lg">
        <span>{en.checkout.subtotal}</span>
        <span className="font-bold">{formatUGX(subtotal)}</span>
      </p>
    </div>
  );
};
