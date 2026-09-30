import React from 'react';
import { Check } from 'lucide-react';
import { OrderStatus } from '../../types';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'payment_held', label: 'Paid' },
  { status: 'being_prepared', label: 'Prepared' },
  { status: 'on_the_way', label: 'On the way' },
  { status: 'delivered', label: 'Delivered' },
];

const MESSAGES: Partial<Record<OrderStatus, string>> = {
  awaiting_payment: 'Waiting for you to approve the payment on your phone.',
  payment_failed: 'The payment was not completed, so no money was taken.',
  cancelled: 'This order was cancelled. Any payment has been refunded to your Mobile Money.',
  problem_reported: 'Problem reported. Payment is on hold while our team looks into it.',
};

export const OrderProgress: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const message = MESSAGES[status];
  if (message) {
    return <p className={`text-sm font-medium ${status === 'awaiting_payment' ? 'text-stone-700' : 'text-soil-700'}`}>{message}</p>;
  }

  const current = STEPS.findIndex(s => s.status === status);

  return (
    <ol className="flex items-center" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step.status} className="flex flex-1 items-center last:flex-none" aria-current={i === current ? 'step' : undefined}>
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  done ? 'bg-brand-700 text-white' : 'border border-stone-300 bg-white text-stone-400'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`whitespace-nowrap text-xs ${done ? 'font-medium text-stone-800' : 'text-stone-500'}`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`mx-2 mb-5 h-0.5 flex-1 ${i < current ? 'bg-brand-700' : 'bg-stone-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  payment_failed: 'Payment failed',
  payment_held: 'Paid',
  being_prepared: 'Being prepared',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  problem_reported: 'Problem reported',
  cancelled: 'Cancelled',
};

export const statusTone = (status: OrderStatus): 'green' | 'soil' | 'amber' | 'neutral' =>
  status === 'delivered' ? 'green'
    : ['problem_reported', 'payment_failed'].includes(status) ? 'soil'
    : status === 'cancelled' ? 'neutral'
    : 'amber';
