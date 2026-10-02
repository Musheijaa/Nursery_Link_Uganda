import type { DeliveryType, OrderStatus, PaymentMethod } from '@nurserylink/shared';
import { Badge } from '@nurserylink/ui';
import { statusLabel, statusTone } from './status';

export const StatusBadge = ({ status, delivery, method }: { status: OrderStatus; delivery: DeliveryType; method?: PaymentMethod }) => (
  <Badge tone={statusTone(status)} className="py-1">{statusLabel(status, delivery, method)}</Badge>
);
