import type { OrderStatus, PaymentMethod } from '@nurserylink/shared';
import { Badge } from '@nurserylink/ui';
import { en } from '../../copy/en';

const TONE: Record<OrderStatus, 'neutral' | 'positive' | 'danger' | 'info' | 'stale'> = {
  pending_payment: 'neutral',
  escrow_held: 'info',
  dispatched: 'info',
  delivered: 'info',
  released: 'positive',
  disputed: 'danger',
  refunded: 'neutral',
  cancelled: 'neutral',
};

/** Trial orders (placed while payments are switched off) were confirmed, not paid. */
export const StatusBadge = ({ status, method }: { status: OrderStatus; method?: PaymentMethod }) => (
  <Badge tone={TONE[status]}>{method === 'trial' && status === 'escrow_held' ? en.orders.trialConfirmed : en.orders.statuses[status]}</Badge>
);
