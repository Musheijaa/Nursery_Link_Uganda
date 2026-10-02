import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import { mobileMoneyNetwork, type OrderStatus } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import type { JobQueue } from '../../jobs/queue.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, ProviderUnavailableError } from '../../lib/errors.js';
import type { PaymentProviders } from '../../providers/index.js';
import type { PaymentProvider, StatusResult } from '../../providers/payment/payment.js';
import type { OrderNotifications } from './notifications.js';
import * as repo from './orders.repo.js';
import { transitionOrder } from './stateMachine.js';

/** Collections still pending after this long are re-checked and, if still pending, cancelled. */
export const PAYMENT_TIMEOUT_SECONDS = 15 * 60;
/** Early status checks after the prompt, so buyers are not left waiting when a callback is missed. */
export const PAYMENT_POLL_SECONDS = [20, 60, 180] as const;
/** Disbursements and refunds are attempted this many times before an admin is asked to step in. */
export const MAX_PAYOUT_ATTEMPTS = 3;

export interface PaymentsDeps {
  db: Database;
  providers: PaymentProviders;
  queue: JobQueue;
  notifications: OrderNotifications;
  logger: Logger;
}

const orderStatusForUpdate = async (tx: DbOrTx, orderId: string): Promise<OrderStatus> => {
  const { rows } = await tx.execute<{ status: OrderStatus }>(sql`SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`);
  const status = rows[0]?.status;
  if (!status) throw new Error(`Order ${orderId} vanished`);
  return status;
};

/**
 * Moves money and applies provider results to orders. Every result is applied under a row lock
 * and only while the payment is still pending, so duplicate callbacks and polling races are no-ops.
 */
export class PaymentsService {
  constructor(private readonly deps: PaymentsDeps) {}

  private provider(payment: Pick<repo.PaymentRow, 'provider'>): PaymentProvider {
    return this.deps.providers.byName(payment.provider);
  }

  /** The provider that pays out to a number: by its network in live mode, the mock otherwise. */
  providerForPayee(msisdn: string, fallback: repo.PaymentRow['provider']): PaymentProvider {
    const network = mobileMoneyNetwork(msisdn);
    const forNetwork = network ? this.deps.providers.forMethod(network) : undefined;
    return forNetwork ?? this.deps.providers.byName(fallback);
  }

  // ── Collections (buyer → escrow) ─────────────────────────

  /** Sends the approval prompt to the buyer's phone. If the provider is down the order is cancelled. */
  async requestCollection(payment: repo.PaymentRow, message: string): Promise<void> {
    try {
      const { providerRef } = await this.provider(payment).requestToPay({
        idempotencyKey: payment.idempotency_key,
        amount: payment.amount,
        msisdn: payment.msisdn,
        message,
      });
      await repo.setProviderRef(this.deps.db, payment.id, providerRef);
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        await this.applyCollectionResult(payment.id, { status: 'failed', reason: 'provider_unavailable' });
      }
      throw err;
    }
    for (const seconds of PAYMENT_POLL_SECONDS) {
      await this.deps.queue.send('payment-poll', { paymentId: payment.id }, { startAfterSeconds: seconds, singletonKey: `poll:${payment.id}:${String(seconds)}` });
    }
    await this.deps.queue.send('payment-timeout', { paymentId: payment.id }, { startAfterSeconds: PAYMENT_TIMEOUT_SECONDS, singletonKey: `timeout:${payment.id}` });
  }

  /** Payment-poll job: asks the provider and applies a final result; a pending one waits for the next check. */
  async pollCollection(paymentId: string): Promise<void> {
    const payment = await repo.findPayment(this.deps.db, paymentId);
    if (payment?.kind !== 'collection' || payment.status !== 'pending' || !payment.provider_ref) return;
    let result: StatusResult;
    try {
      result = await this.provider(payment).getPaymentStatus(payment.provider_ref);
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError)) throw err;
      this.deps.logger.warn({ err, paymentId }, 'Payment status check failed; a later check will retry');
      return;
    }
    await this.applyCollectionResult(paymentId, result);
  }

  /**
   * Applies a collection outcome. Success moves the order to escrow; failure cancels it and
   * returns the stock. Money that arrives after the order was cancelled is refunded.
   */
  async applyCollectionResult(paymentId: string, result: StatusResult, rawCallback?: unknown): Promise<void> {
    if (result.status === 'pending') return;
    const status = result.status;

    const outcome = await this.deps.db.transaction(async tx => {
      const payment = await repo.findPayment(tx, paymentId, true);
      // A collection we gave up on (timed out) can still turn out to have succeeded at the provider
      const lateSuccess = payment?.status === 'failed' && status === 'successful';
      if (!payment || payment.kind !== 'collection' || (payment.status !== 'pending' && !lateSuccess)) return { kind: 'ignored' as const };

      await repo.settlePayment(tx, payment.id, status, rawCallback ?? result.raw ?? null);
      await writeAudit(tx, {
        actorId: null, action: `payment.${status}`, entity: 'payment', entityId: payment.id,
        before: { status: payment.status }, after: { status, reason: result.reason ?? null, kind: 'collection', amount: payment.amount },
      });

      const orderStatus = await orderStatusForUpdate(tx, payment.order_id);
      if (status === 'successful') {
        if (orderStatus === 'pending_payment') {
          // Trial orders (payments switched off) are confirmed without any money changing hands
          await transitionOrder(tx, payment.order_id, 'escrow_held', { actorId: null, reason: result.reason === 'trial' ? 'Confirmed (trial, no payment)' : 'Payment received' });
          return { kind: 'paid' as const, orderId: payment.order_id };
        }
        // Paid after the order had already been cancelled (e.g. approved after the timeout): send it back
        const refund = await repo.insertPayment(tx, { orderId: payment.order_id, kind: 'refund', provider: payment.provider, msisdn: payment.msisdn, amount: payment.amount });
        await writeAudit(tx, {
          actorId: null, action: 'payment.refund_requested', entity: 'payment', entityId: refund.id,
          after: { reason: `Payment arrived after the order was ${orderStatus}`, amount: payment.amount },
        });
        return { kind: 'late' as const, refundId: refund.id };
      }

      if (orderStatus === 'pending_payment') {
        await transitionOrder(tx, payment.order_id, 'cancelled', { actorId: null, reason: `Payment failed: ${result.reason ?? 'declined'}` });
        await repo.restoreStock(tx, payment.order_id);
      }
      return { kind: 'failed' as const };
    });

    if (outcome.kind === 'paid') {
      const order = await repo.findOrder(this.deps.db, outcome.orderId);
      if (order) await this.deps.notifications.paymentReceived(order);
    }
    if (outcome.kind === 'late') await this.startPayout(outcome.refundId);
  }

  /** Payment-timeout job: ask the provider once more, then cancel if the buyer never approved. */
  async timeoutCollection(paymentId: string): Promise<void> {
    const payment = await repo.findPayment(this.deps.db, paymentId);
    if (!payment || payment.status !== 'pending') return;
    let result: StatusResult = { status: 'pending' };
    if (payment.provider_ref) result = await this.provider(payment).getPaymentStatus(payment.provider_ref);
    await this.applyCollectionResult(paymentId, result.status === 'pending' ? { status: 'failed', reason: 'timed_out' } : result);
  }

  // ── Payouts (escrow → nursery) and refunds (escrow → buyer) ─

  /** Creates a disbursement of the order total to the nursery. Call inside the transaction that moved the order. */
  async createNurseryPayout(tx: DbOrTx, orderId: string): Promise<repo.PaymentRow> {
    const order = await repo.findOrder(tx, orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    await this.assertNoActivePayout(tx, orderId);
    const collection = await repo.collectionForOrder(tx, orderId);
    return repo.insertPayment(tx, {
      orderId,
      kind: 'disbursement',
      provider: this.providerForPayee(order.nursery_payout_phone, collection?.provider ?? 'mock').name,
      msisdn: order.nursery_payout_phone,
      amount: order.grand_total,
    });
  }

  /** Creates a refund of the collected amount to the number that paid. */
  async createRefund(tx: DbOrTx, orderId: string): Promise<repo.PaymentRow> {
    await this.assertNoActivePayout(tx, orderId);
    const collection = await repo.collectionForOrder(tx, orderId);
    if (collection?.status !== 'successful') throw new ConflictError('Nothing was collected for this order, so there is nothing to refund.');
    return repo.insertPayment(tx, {
      orderId, kind: 'refund', provider: collection.provider, msisdn: collection.msisdn, amount: collection.amount,
    });
  }

  private async assertNoActivePayout(tx: DbOrTx, orderId: string) {
    const payouts = await repo.payoutsForOrder(tx, orderId);
    if (payouts.some(p => p.status === 'pending')) throw new ConflictError('A payment for this order is already in progress.');
    if (payouts.some(p => p.status === 'successful')) throw new ConflictError('This order has already been paid out.');
  }

  /** Sends a disbursement or refund to the provider, then schedules a status check. */
  async startPayout(paymentId: string): Promise<void> {
    const payment = await repo.findPayment(this.deps.db, paymentId);
    if (!payment || payment.status !== 'pending' || payment.kind === 'collection') return;
    const order = await repo.findOrder(this.deps.db, payment.order_id);
    try {
      const { providerRef } = await this.provider(payment).disburse({
        idempotencyKey: payment.idempotency_key,
        amount: payment.amount,
        msisdn: payment.msisdn,
        message: `Nursery Link order ${order?.short_code ?? ''}`.trim(),
      });
      await repo.setProviderRef(this.deps.db, payment.id, providerRef);
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError)) throw err;
      this.deps.logger.warn({ err, paymentId }, 'Payout could not be sent');
      await this.applyPayoutResult(paymentId, { status: 'failed', reason: 'provider_unavailable' });
      return;
    }
    await this.deps.queue.send('payout-check', { paymentId }, { singletonKey: `payout:${paymentId}` });
  }

  /**
   * Payout-check job. Re-sends a payout that never reached the provider, applies a final result,
   * and throws while the provider still reports pending so the job retries with backoff.
   */
  async checkPayout(paymentId: string): Promise<void> {
    const payment = await repo.findPayment(this.deps.db, paymentId);
    if (!payment || payment.status !== 'pending' || payment.kind === 'collection') return;
    if (!payment.provider_ref) {
      await this.startPayout(paymentId);
      return;
    }
    const result = await this.provider(payment).getDisbursementStatus(payment.provider_ref);
    if (result.status === 'pending') throw new Error(`Payout ${paymentId} is still pending at ${payment.provider}`);
    await this.applyPayoutResult(paymentId, result);
  }

  /**
   * Applies a payout outcome. Success releases (or refunds) the order. Failure schedules another
   * attempt with backoff; after MAX_PAYOUT_ATTEMPTS the order is flagged for an admin.
   */
  async applyPayoutResult(paymentId: string, result: StatusResult, rawCallback?: unknown): Promise<void> {
    if (result.status === 'pending') return;
    const status = result.status;

    const outcome = await this.deps.db.transaction(async tx => {
      const payment = await repo.findPayment(tx, paymentId, true);
      if (!payment || payment.kind === 'collection' || payment.status !== 'pending') return { kind: 'ignored' as const };

      await repo.settlePayment(tx, payment.id, status, rawCallback ?? result.raw ?? null);
      await writeAudit(tx, {
        actorId: null, action: `payment.${status}`, entity: 'payment', entityId: payment.id,
        before: { status: 'pending' }, after: { status, reason: result.reason ?? null, kind: payment.kind, amount: payment.amount },
      });

      const orderStatus = await orderStatusForUpdate(tx, payment.order_id);
      if (status === 'successful') {
        if (payment.kind === 'disbursement') {
          await transitionOrder(tx, payment.order_id, 'released', { actorId: null, reason: 'Payment sent to the nursery' });
        } else if (orderStatus === 'escrow_held' || orderStatus === 'disputed') {
          await transitionOrder(tx, payment.order_id, 'refunded', { actorId: null, reason: 'Refund sent to the buyer' });
        }
        return { kind: 'paid' as const, payment };
      }

      const attempts = (await repo.payoutsForOrder(tx, payment.order_id)).filter(p => p.kind === payment.kind).length;
      if (attempts >= MAX_PAYOUT_ATTEMPTS) {
        await writeAudit(tx, {
          actorId: null, action: 'payout.flagged', entity: 'order', entityId: payment.order_id,
          after: { payment_id: payment.id, kind: payment.kind, attempts, reason: result.reason ?? 'failed' },
        });
        return { kind: 'flagged' as const };
      }
      const retry = await repo.insertPayment(tx, {
        orderId: payment.order_id, kind: payment.kind, provider: payment.provider, msisdn: payment.msisdn, amount: payment.amount,
      });
      return { kind: 'retry' as const, retryId: retry.id, attempts };
    });

    if (outcome.kind === 'paid') {
      const order = await repo.findOrder(this.deps.db, outcome.payment.order_id);
      if (order && outcome.payment.kind === 'disbursement') await this.deps.notifications.released(order, outcome.payment.amount);
      if (order && outcome.payment.kind === 'refund') await this.deps.notifications.refunded(order, outcome.payment.amount, outcome.payment.msisdn);
    }
    if (outcome.kind === 'retry') {
      // Back off 1, 2, … minutes before the next attempt; the check sends it
      await this.deps.queue.send('payout-check', { paymentId: outcome.retryId }, { startAfterSeconds: 60 * outcome.attempts, singletonKey: `payout:${outcome.retryId}` });
    }
  }

  // ── Webhooks ─────────────────────────────────────────────

  /**
   * Handles a provider callback. The body only identifies the payment: the outcome is always
   * fetched from the provider, so a forged or replayed callback cannot change anything.
   */
  async handleCallback(payment: repo.PaymentRow, body: unknown): Promise<'applied' | 'duplicate' | 'pending'> {
    // A failed collection is re-checked once more: a buyer may approve after we timed the order out
    const recheck = payment.kind === 'collection' && payment.status === 'failed';
    if (payment.status !== 'pending' && !recheck) return 'duplicate';
    if (!payment.provider_ref) return 'pending';
    const provider = this.provider(payment);
    const result = payment.kind === 'collection'
      ? await provider.getPaymentStatus(payment.provider_ref)
      : await provider.getDisbursementStatus(payment.provider_ref);
    if (result.status === 'pending') return 'pending';
    if (recheck && result.status === 'failed') return 'duplicate';
    if (payment.kind === 'collection') await this.applyCollectionResult(payment.id, result, body);
    else await this.applyPayoutResult(payment.id, result, body);
    return 'applied';
  }
}
