import type { Vehicle } from '@nurserylink/shared';

export interface DeliveryRate {
  id: string;
  vehicle: Vehicle;
  maxItems: number;
  baseFee: number;
  perKm: number;
  maxKm: number;
}

export type FeeResult =
  | { ok: true; rate: DeliveryRate; fee: number; billedKm: number }
  | { ok: false; reason: 'too_many_items' | 'too_far'; maxItems?: number; maxKm?: number };

/** Fee for one rate: base + per_km × whole kilometres, rounded up. */
export const feeFor = (rate: Pick<DeliveryRate, 'baseFee' | 'perKm'>, km: number): number => rate.baseFee + rate.perKm * Math.ceil(km);

/**
 * Picks the cheapest active rate that can carry the order: its max_items must fit the number of
 * seedlings and its max_km must cover the distance. Explains which limit ruled everything out.
 */
export const chooseDeliveryRate = (rates: DeliveryRate[], items: number, km: number): FeeResult => {
  const fitsItems = rates.filter(r => r.maxItems >= items);
  if (fitsItems.length === 0) {
    return { ok: false, reason: 'too_many_items', maxItems: Math.max(0, ...rates.map(r => r.maxItems)) };
  }
  const fitsDistance = fitsItems.filter(r => r.maxKm >= km);
  if (fitsDistance.length === 0) {
    return { ok: false, reason: 'too_far', maxKm: Math.max(...fitsItems.map(r => r.maxKm)) };
  }
  const best = fitsDistance
    .map(rate => ({ rate, fee: feeFor(rate, km) }))
    .sort((a, b) => a.fee - b.fee || a.rate.maxItems - b.rate.maxItems)[0];
  if (!best) return { ok: false, reason: 'too_far' };
  return { ok: true, rate: best.rate, fee: best.fee, billedKm: Math.ceil(km) };
};
