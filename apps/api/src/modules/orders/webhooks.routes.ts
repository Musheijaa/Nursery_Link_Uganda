import express, { Router } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';
import { paymentProviderSchema, ugandaPhoneSchema } from '@nurserylink/shared';
import type { Config } from '../../config.js';
import type { Database } from '../../db/client.js';
import { safeEqual } from '../../lib/crypto.js';
import { NotFoundError, ProviderUnavailableError, UnauthorizedError } from '../../lib/errors.js';
import type { SmsProvider } from '../../providers/sms/sms.js';
import type { Limit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as repo from './orders.repo.js';
import type { OrdersService } from './orders.service.js';
import type { PaymentsService } from './payments.service.js';

export const providerParams = z.object({ provider: paymentProviderSchema });

/** Pulls whichever reference a provider's callback carries (ours or theirs). */
export const callbackReference = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;
  const b = body as Record<string, unknown>;
  const transaction = typeof b.transaction === 'object' && b.transaction !== null ? (b.transaction as Record<string, unknown>) : {};
  // mock: reference · MTN: externalId / financialTransactionId · Airtel: transaction.id
  for (const candidate of [b.reference, b.externalId, b.referenceId, b.financialTransactionId, transaction.id]) {
    if (typeof candidate === 'string' && candidate.length > 0 && candidate.length <= 200) return candidate;
  }
  return undefined;
};

export const webhookRoutes = (deps: {
  db: Database;
  config: Config;
  payments: PaymentsService;
  orders: OrdersService;
  sms: SmsProvider;
  logger: Logger;
  limit: Limit;
}): Router => {
  const router = Router();
  // Providers call from a few addresses, so this is per IP and high; it only stops floods
  router.use(deps.limit({ windowMinutes: 1, limit: 600 }));

  /**
   * Payment callbacks. Idempotent: the payment is found by reference, anything no longer pending
   * is acknowledged and ignored, and the outcome is fetched from the provider, never taken from the body.
   */
  router.post('/payments/:provider', validate({ params: providerParams }), async (req, res) => {
    const { provider } = (res.locals.validated as { params: z.output<typeof providerParams> }).params;
    const reference = callbackReference(req.body);
    const payment = reference ? await repo.findPaymentByReference(deps.db, provider, reference) : undefined;
    if (!payment) {
      deps.logger.warn({ provider, reference }, 'Payment callback for an unknown payment');
      res.json({ data: { received: true, result: 'unknown_payment' } });
      return;
    }
    let result: string;
    try {
      result = await deps.payments.handleCallback(payment, req.body);
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError)) throw err;
      // The provider could not confirm the status right now; the timeout and payout jobs will re-check
      deps.logger.warn({ err, paymentId: payment.id }, 'Could not verify payment callback with the provider');
      result = 'verification_deferred';
    }
    res.json({ data: { received: true, result } });
  });

  /** Inbound SMS (Africa's Talking posts form fields). Always 200, so the gateway does not retry. */
  router.post('/sms/inbound', express.urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
    const expected = deps.config.SMS_INBOUND_TOKEN;
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (expected && !safeEqual(token, expected)) throw new UnauthorizedError('Invalid inbound SMS token');

    const message = deps.sms.parseInbound(req.body);
    if (!message) {
      res.json({ data: { received: true, result: 'not_a_message' } });
      return;
    }
    res.json({ data: { received: true, result: await deps.orders.handleNurseryReply(message) } });
  });

  return router;
};

/**
 * Development and end-to-end test helpers, never mounted in production. Each exists only while
 * the matching provider is the mock: approving a mock payment stands in for the buyer's phone,
 * and the SMS outbox stands in for reading a text (e.g. a verification code).
 */
export const devRoutes = (deps: {
  db: Database;
  payments: PaymentsService;
  settle?: ((providerRef: string, status: 'successful' | 'failed') => void) | undefined;
  outbox?: ((to: string) => { message: string; at: Date }[]) | undefined;
}): Router => {
  const router = Router();
  const { settle, outbox } = deps;
  if (settle) {
    const body = z.object({ order_id: z.uuid(), status: z.enum(['successful', 'failed']) });
    router.post('/mock-payments/settle', validate({ body }), async (_req, res) => {
      const { order_id, status } = (res.locals.validated as { body: z.output<typeof body> }).body;
      const payment = await repo.collectionForOrder(deps.db, order_id);
      if (payment?.status !== 'pending' || !payment.provider_ref) throw new NotFoundError('No pending payment for this order');
      settle(payment.provider_ref, status);
      res.json({ data: { result: await deps.payments.handleCallback(payment, { reference: payment.provider_ref, dev: true }) } });
    });
  }
  if (outbox) {
    const query = z.object({ to: ugandaPhoneSchema });
    router.get('/sms-outbox', validate({ query }), (_req, res) => {
      const { to } = (res.locals.validated as { query: z.output<typeof query> }).query;
      // Newest first, so a test can take the latest code
      res.json({ data: outbox(to).map(m => ({ message: m.message, sent_at: m.at.toISOString() })).reverse() });
    });
  }
  return router;
};
