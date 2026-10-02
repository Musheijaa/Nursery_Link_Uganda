import type { PaymentsService } from '../modules/orders/payments.service.js';
import type { JobPayloads } from './queue.js';

/**
 * Checks a disbursement or refund. Pending → throws so the job retries later. Failed → the payments
 * service schedules the next attempt, and flags the order for an admin after 3 attempts.
 */
export const payoutCheck = (payments: PaymentsService) => async ({ paymentId }: JobPayloads['payout-check']) => {
  await payments.checkPayout(paymentId);
};
