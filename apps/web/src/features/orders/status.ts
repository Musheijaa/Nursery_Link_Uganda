import type { DeliveryType, OrderStatus, PaymentMethod } from '@nurserylink/shared';
import { en } from '../../copy/en';

export type StatusTone = 'positive' | 'info' | 'danger' | 'neutral';

/**
 * What the buyer reads for each backend state, e.g. escrow_held → "Paid — nursery notified".
 * Trial orders (placed while payments are switched off) say "Confirmed" instead of "Paid".
 */
export const statusLabel = (status: OrderStatus, delivery: DeliveryType, method?: PaymentMethod): string => {
  if (status === 'dispatched' && delivery === 'self_pickup') return en.orderStatus.dispatched_pickup;
  if (method === 'trial' && status in en.orderStatusTrial) return en.orderStatusTrial[status as keyof typeof en.orderStatusTrial];
  return en.orderStatus[status];
};

export const statusTone = (status: OrderStatus): StatusTone => {
  switch (status) {
    case 'released':
    case 'escrow_held':
    case 'delivered':
      return 'positive';
    case 'dispatched':
    case 'pending_payment':
      return 'info';
    case 'disputed':
    case 'cancelled':
      return 'danger';
    case 'refunded':
      return 'neutral';
  }
};

export interface TimelineStep {
  key: 'ordered' | 'paid' | 'dispatched' | 'delivered' | 'completed';
  label: string;
  at: string | null;
  state: 'done' | 'current' | 'upcoming';
}

interface Times {
  created_at: string;
  paid_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  released_at: string | null;
}

// How many of the five steps are finished in each state (side states keep what was finished)
const DONE: Record<OrderStatus, number> = {
  pending_payment: 1,
  escrow_held: 2,
  dispatched: 3,
  delivered: 4,
  released: 5,
  disputed: 2,
  refunded: 2,
  cancelled: 1,
};

/** The five-step progress line: Ordered → Paid → On the way → Delivered → Completed. */
export const timeline = (status: OrderStatus, delivery: DeliveryType, t: Times, method?: PaymentMethod): TimelineStep[] => {
  const done = status === 'disputed' && t.dispatched_at ? 3 : DONE[status];
  const steps: Omit<TimelineStep, 'state'>[] = [
    { key: 'ordered', label: en.timeline.ordered, at: t.created_at },
    { key: 'paid', label: method === 'trial' ? en.timeline.confirmed : en.timeline.paid, at: t.paid_at },
    { key: 'dispatched', label: delivery === 'self_pickup' ? en.timeline.dispatched_pickup : en.timeline.dispatched, at: t.dispatched_at },
    { key: 'delivered', label: en.timeline.delivered, at: t.delivered_at },
    { key: 'completed', label: en.timeline.completed, at: t.released_at },
  ];
  // The next unfinished step is "in progress", unless the order has stopped (cancelled, refunded, disputed)
  const stopped = ['cancelled', 'refunded', 'disputed'].includes(status);
  return steps.map((step, i) => ({
    ...step,
    state: i < done ? 'done' : i === done && !stopped ? 'current' : 'upcoming',
  }));
};

/** The 72-hour automatic confirmation after dispatch. */
export const AUTO_CONFIRM_HOURS = 72;
export const autoConfirmAt = (dispatchedAt: string): Date => new Date(new Date(dispatchedAt).getTime() + AUTO_CONFIRM_HOURS * 3600_000);
