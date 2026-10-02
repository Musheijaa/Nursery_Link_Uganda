import { sql } from 'drizzle-orm';
import { ORDER_TRANSITIONS, canTransition, isFinalStatus, type OrderStatus } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';

// The transition table lives in @nurserylink/shared so the admin console offers the same moves
export const TRANSITIONS = ORDER_TRANSITIONS;
export { canTransition };
export const isFinal = isFinalStatus;

// Each status that has a timestamp column gets it stamped on entry
const TIMESTAMP_COLUMN: Partial<Record<OrderStatus, string>> = {
  escrow_held: 'paid_at',
  dispatched: 'dispatched_at',
  delivered: 'delivered_at',
  released: 'released_at',
};

export class IllegalTransitionError extends ConflictError {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`An order that is ${from.replace(/_/g, ' ')} cannot become ${to.replace(/_/g, ' ')}`, { from, to });
  }
}

export interface TransitionOptions {
  /** null for system actions (webhooks, jobs, SMS replies) */
  actorId: string | null;
  reason: string;
  /** Only allow the transition from these states (defaults to any state the table allows) */
  from?: readonly OrderStatus[];
}

/**
 * Moves an order to a new status inside the caller's transaction: locks the row, checks the
 * transition, stamps the matching timestamp and writes the audit entry. Returns the previous status.
 */
export const transitionOrder = async (tx: DbOrTx, orderId: string, to: OrderStatus, options: TransitionOptions): Promise<OrderStatus> => {
  const locked = await tx.execute<{ status: OrderStatus }>(sql`SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`);
  const current = locked.rows[0]?.status;
  if (!current) throw new NotFoundError('Order not found');
  if (!canTransition(current, to) || (options.from && !options.from.includes(current))) {
    throw new IllegalTransitionError(current, to);
  }

  const column = TIMESTAMP_COLUMN[to];
  await tx.execute(sql`
    UPDATE orders SET status = ${to}${column ? sql`, ${sql.identifier(column)} = now()` : sql``}
    WHERE id = ${orderId}`);
  await writeAudit(tx, {
    actorId: options.actorId,
    action: 'order.status_changed',
    entity: 'order',
    entityId: orderId,
    before: { status: current },
    after: { status: to, reason: options.reason },
  });
  return current;
};

