import { orderStatuses } from '@nurserylink/shared';
import { describe, expect, it } from 'vitest';
import { autoConfirmAt, statusLabel, statusTone, timeline } from './status';

const at: Parameters<typeof timeline>[2] = { created_at: '2026-10-01T08:00:00Z', paid_at: null, dispatched_at: null, delivered_at: null, released_at: null };

describe('order status in plain language', () => {
  it.each([
    ['pending_payment', 'Waiting for your payment'],
    ['escrow_held', 'Paid — nursery notified'],
    ['dispatched', 'On the way'],
    ['delivered', 'Delivered — paying the nursery'],
    ['released', 'Completed'],
    ['disputed', 'Problem reported — our team is helping'],
    ['refunded', 'Refunded'],
    ['cancelled', 'Cancelled — payment not completed'],
  ] as const)('%s → "%s"', (status, label) => {
    expect(statusLabel(status, 'order_and_deliver')).toBe(label);
  });

  it('says "Ready to collect" instead of "On the way" for collection orders', () => {
    expect(statusLabel('dispatched', 'self_pickup')).toBe('Ready to collect');
  });

  it('gives every state a label and a tone', () => {
    for (const s of orderStatuses) {
      expect(statusLabel(s, 'order_and_deliver')).toMatch(/\w/);
      expect(statusTone(s)).toBeDefined();
    }
  });
});

describe('timeline', () => {
  const states = (status: Parameters<typeof timeline>[0], t = at) => timeline(status, 'order_and_deliver', t).map(s => s.state);

  it('marks the current step and what is still to come', () => {
    expect(states('pending_payment')).toEqual(['done', 'current', 'upcoming', 'upcoming', 'upcoming']);
    // Paid is finished; the next step (on the way) is what's in progress
    expect(states('escrow_held', { ...at, paid_at: '2026-10-01T08:05:00Z' })).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(states('dispatched')).toEqual(['done', 'done', 'done', 'current', 'upcoming']);
  });

  it('shows every step done once the order is completed', () => {
    expect(states('released')).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('stops without a "current" step when an order is cancelled or in dispute', () => {
    expect(states('cancelled')).toEqual(['done', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(states('disputed', { ...at, paid_at: 'x', dispatched_at: 'y' })).toEqual(['done', 'done', 'done', 'upcoming', 'upcoming']);
  });

  it('names the third step for collection orders', () => {
    expect(timeline('dispatched', 'self_pickup', at)[2]?.label).toBe('Ready');
  });

  it('confirms automatically 72 hours after dispatch', () => {
    expect(autoConfirmAt('2026-10-01T08:00:00Z').toISOString()).toBe('2026-10-04T08:00:00.000Z');
  });
});
