import { describe, expect, it } from 'vitest';
import { chooseDeliveryRate, feeFor, type DeliveryRate } from './fees.js';

const boda: DeliveryRate = { id: 'boda', vehicle: 'motorcycle', maxItems: 300, baseFee: 5000, perKm: 1500, maxKm: 40 };
const truck: DeliveryRate = { id: 'truck', vehicle: 'truck', maxItems: 20000, baseFee: 60000, perKm: 2500, maxKm: 200 };
const bigBoda: DeliveryRate = { id: 'big-boda', vehicle: 'motorcycle', maxItems: 500, baseFee: 8000, perKm: 1500, maxKm: 40 };

describe('feeFor', () => {
  it('charges base + per_km × kilometres rounded up', () => {
    expect(feeFor(boda, 10)).toBe(20000);
    expect(feeFor(boda, 10.01)).toBe(21500);
    expect(feeFor(boda, 0)).toBe(5000);
    expect(feeFor(truck, 0.2)).toBe(62500);
  });
});

describe('chooseDeliveryRate', () => {
  it('picks the cheapest rate that fits both items and distance', () => {
    expect(chooseDeliveryRate([truck, boda], 120, 7.3)).toEqual({ ok: true, rate: boda, fee: 17000, billedKm: 8 });
  });

  it('moves up to a bigger vehicle when the order is too big for a boda', () => {
    expect(chooseDeliveryRate([truck, boda], 301, 7.3)).toMatchObject({ ok: true, rate: truck, fee: 80000 });
    expect(chooseDeliveryRate([truck, boda, bigBoda], 400, 7.3)).toMatchObject({ ok: true, rate: bigBoda });
  });

  it('uses the truck when the boda cannot go that far', () => {
    expect(chooseDeliveryRate([truck, boda], 50, 41)).toMatchObject({ ok: true, rate: truck, fee: 162500 });
  });

  it('explains why nothing fits', () => {
    expect(chooseDeliveryRate([truck, boda], 25000, 5)).toEqual({ ok: false, reason: 'too_many_items', maxItems: 20000 });
    expect(chooseDeliveryRate([truck, boda], 100, 250)).toEqual({ ok: false, reason: 'too_far', maxKm: 200 });
    expect(chooseDeliveryRate([], 1, 1)).toEqual({ ok: false, reason: 'too_many_items', maxItems: 0 });
  });
});
