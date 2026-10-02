import type { DeliveryType, OrderStatus, PaymentMethod } from '@nurserylink/shared';
import { cn, formatDateTime } from '@nurserylink/ui';
import { Check } from 'lucide-react';
import { en } from '../../copy/en';
import { timeline, type TimelineStep } from './status';

/** Ordered → Paid → On the way → Delivered → Completed, with when each happened. */
export const OrderTimeline = ({ status, delivery, times, method }: { status: OrderStatus; delivery: DeliveryType; times: Parameters<typeof timeline>[2]; method?: PaymentMethod }) => {
  const steps: TimelineStep[] = timeline(status, delivery, times, method);
  return (
    <ol aria-label={en.order.timelineHeading} className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className="flex gap-3">
          <span className="flex flex-col items-center">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
                s.state === 'done' ? 'bg-seedling text-paper' : s.state === 'current' ? 'bg-forest text-paper ring-4 ring-forest-tint' : 'bg-paper ring-1 ring-field'
              )}
            >
              {s.state === 'done' && <Check aria-hidden className="size-4" />}
            </span>
            {i < steps.length - 1 && <span aria-hidden className={cn('w-0.5 flex-1', s.state === 'done' ? 'bg-seedling' : 'bg-line')} />}
          </span>
          <span className="flex flex-col pb-5">
            <span className={cn('font-bold', s.state === 'upcoming' ? 'text-bark-muted' : 'text-canopy')}>
              {s.label}
              <span className="sr-only">{s.state === 'done' ? ' (done)' : s.state === 'current' ? ' (now)' : ' (not yet)'}</span>
            </span>
            {s.at && s.state !== 'upcoming' && <span className="text-sm text-bark-muted">{formatDateTime(s.at)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
};
