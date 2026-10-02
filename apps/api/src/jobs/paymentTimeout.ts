import type { PaymentsService } from '../modules/orders/payments.service.js';
import type { JobPayloads } from './queue.js';

/** A collection still pending 15 minutes after the prompt: re-check with the provider, else cancel and restock. */
export const paymentTimeout = (payments: PaymentsService) => async ({ paymentId }: JobPayloads['payment-timeout']) => {
  await payments.timeoutCollection(paymentId);
};

/** An early status check (20 s, 1 min, 3 min after the prompt); applies the result only if it is final. */
export const paymentPoll = (payments: PaymentsService) => async ({ paymentId }: JobPayloads['payment-poll']) => {
  await payments.pollCollection(paymentId);
};
