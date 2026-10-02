import type { OrderStatus } from './enums.js';

/**
 * The only legal order transitions. The API enforces them (apps/api orders/stateMachine.ts) and
 * the admin console uses them to offer only the actions allowed from an order's current state.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['escrow_held', 'cancelled'],
  escrow_held: ['dispatched', 'disputed', 'refunded'],
  dispatched: ['delivered', 'disputed'],
  delivered: ['released'],
  disputed: ['refunded', 'released', 'dispatched'],
  released: [],
  refunded: [],
  cancelled: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => ORDER_TRANSITIONS[from].includes(to);

export const isFinalStatus = (status: OrderStatus): boolean => ORDER_TRANSITIONS[status].length === 0;

/** What an admin can do to an order (PUT /admin/orders/:id/status), each with a required reason. */
export const adminOrderActionList = ['dispatched', 'refunded', 'released'] as const;
export type AdminOrderAction = (typeof adminOrderActionList)[number];

/**
 * The admin actions allowed from a status. Some take a step through another state:
 *  - refunded: an order that is paid or on its way is first marked disputed, then refunded;
 *  - released: a dispatched order is first marked delivered, then the nursery is paid.
 */
export const adminOrderActions = (status: OrderStatus): AdminOrderAction[] => {
  const actions: AdminOrderAction[] = [];
  if (canTransition(status, 'dispatched')) actions.push('dispatched');
  if (status === 'escrow_held' || status === 'dispatched' || status === 'disputed') actions.push('refunded');
  if (status === 'dispatched' || status === 'delivered' || status === 'disputed') actions.push('released');
  return actions;
};
