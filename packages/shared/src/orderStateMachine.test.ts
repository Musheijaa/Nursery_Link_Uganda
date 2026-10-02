import { describe, expect, it } from 'vitest';
import { orderStatuses } from './enums.js';
import { adminOrderActions, canTransition, isFinalStatus } from './orderStateMachine.js';

describe('admin order actions', () => {
  it.each([
    ['pending_payment', []],
    ['escrow_held', ['dispatched', 'refunded']],
    ['dispatched', ['refunded', 'released']],
    ['delivered', ['released']],
    ['disputed', ['dispatched', 'refunded', 'released']],
    ['released', []],
    ['refunded', []],
    ['cancelled', []],
  ] as const)('%s → %j', (status, actions) => {
    expect(adminOrderActions(status)).toEqual(actions);
  });

  it('offers nothing on a finished order', () => {
    for (const s of orderStatuses.filter(isFinalStatus)) expect(adminOrderActions(s)).toEqual([]);
  });

  it('agrees with the transition table', () => {
    expect(canTransition('escrow_held', 'dispatched')).toBe(true);
    expect(canTransition('delivered', 'dispatched')).toBe(false);
  });
});
