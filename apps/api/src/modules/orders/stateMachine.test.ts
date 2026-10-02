import { describe, expect, it } from 'vitest';
import { orderStatuses, type OrderStatus } from '@nurserylink/shared';
import { canTransition, isFinal, TRANSITIONS } from './stateMachine.js';

// The table from the specification, written out independently of the implementation
const LEGAL: [OrderStatus, OrderStatus][] = [
  ['pending_payment', 'escrow_held'],
  ['pending_payment', 'cancelled'],
  ['escrow_held', 'dispatched'],
  ['escrow_held', 'disputed'],
  ['escrow_held', 'refunded'],
  ['dispatched', 'delivered'],
  ['dispatched', 'disputed'],
  ['delivered', 'released'],
  ['disputed', 'refunded'],
  ['disputed', 'released'],
  ['disputed', 'dispatched'],
];

const allPairs = orderStatuses.flatMap(from => orderStatuses.map(to => [from, to] as [OrderStatus, OrderStatus]));
const isLegal = (from: OrderStatus, to: OrderStatus) => LEGAL.some(([f, t]) => f === from && t === to);

describe('order state machine', () => {
  it.each(LEGAL)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(allPairs.filter(([from, to]) => !isLegal(from, to)))('forbids %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('has exactly the specified transitions and nothing more', () => {
    const implemented = Object.entries(TRANSITIONS).flatMap(([from, tos]) => tos.map(to => `${from}->${to}`)).sort();
    expect(implemented).toEqual(LEGAL.map(([f, t]) => `${f}->${t}`).sort());
  });

  it('treats released, refunded and cancelled as final', () => {
    expect(orderStatuses.filter(isFinal).sort()).toEqual(['cancelled', 'refunded', 'released']);
  });
});
