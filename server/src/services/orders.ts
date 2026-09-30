import type pg from 'pg';
import { pool, query, withTransaction } from '../db/pool.js';
import { randomDigits } from '../lib/crypto.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import type { PaymentNetwork } from '../lib/phone.js';
import { DeliveryMethod, ROAD_FACTOR, quoteDelivery } from './delivery.js';
import { ProviderError, ProviderStatus, providerByName, providerForNetwork } from './payments/index.js';
import { sendSms } from './sms.js';

export type OrderStatus =
  | 'awaiting_payment' | 'payment_failed' | 'payment_held' | 'being_prepared'
  | 'on_the_way' | 'delivered' | 'problem_reported' | 'cancelled';

/** Minutes a buyer has to approve the payment before the reserved stock is released. */
export const PAYMENT_TIMEOUT_MINUTES = 15;

const formatUGX = (n: number) => `UGX ${n.toLocaleString('en-UG')}`;

// ── Status transitions ─────────────────────────────────────

const transition = async (
  db: pg.PoolClient,
  orderId: string,
  from: OrderStatus[],
  to: OrderStatus,
  actorId: string | null,
  note?: string,
  extraSet = ''
) => {
  const { rows } = await db.query<{ id: string }>(
    `UPDATE orders SET status = $2 ${extraSet} WHERE id = $1 AND status = ANY($3::order_status[]) RETURNING id`,
    [orderId, to, from]
  );
  if (!rows[0]) throw conflict('This order has already moved on. Refresh to see its current status.', 'invalid_transition');
  await db.query('INSERT INTO order_events (order_id, status, actor_id, note) VALUES ($1, $2, $3, $4)', [orderId, to, actorId, note ?? null]);
};

const restoreStock = (db: pg.PoolClient, orderId: string) =>
  db.query(
    `UPDATE seedling_batches b SET quantity_available = b.quantity_available + i.quantity
     FROM order_items i WHERE i.order_id = $1 AND i.batch_id = b.id`,
    [orderId]
  );

// ── Creating an order ──────────────────────────────────────

export interface CreateOrderInput {
  nurseryId: string;
  items: { batchId: string; quantity: number }[];
  deliveryMethod: DeliveryMethod;
  deliveryDistrict: string;
  deliveryArea: string;
  deliveryLandmark: string;
  buyerName: string;
  paymentNetwork: PaymentNetwork;
  paymentPhone: string;
}

export const createOrder = async (buyer: { id: string; phone: string }, input: CreateOrderInput) => {
  const batchIds = input.items.map(i => i.batchId);
  if (new Set(batchIds).size !== batchIds.length) throw badRequest('Each batch can only appear once in an order');

  const created = await withTransaction(async db => {
    const { rows: [nursery] } = await db.query<{ id: string; name: string; phone: string; delivery_methods: DeliveryMethod[]; district_id: number }>(
      `SELECT id, name, phone, delivery_methods, district_id FROM nurseries WHERE id = $1 AND status = 'active'`,
      [input.nurseryId]
    );
    if (!nursery) throw notFound('That nursery is not taking orders');
    if (!nursery.delivery_methods.includes(input.deliveryMethod)) {
      throw badRequest(`${nursery.name} does not offer "${input.deliveryMethod}"`);
    }

    const isCollection = input.deliveryMethod === 'Collect from nursery';
    let district: { id: number; road_km: number } | undefined;
    if (isCollection) {
      district = { id: nursery.district_id, road_km: 0 };
    } else {
      const { rows } = await db.query<{ id: number; road_km: number }>(
        `SELECT d.id, ST_Distance(d.location, n.location) / 1000 * $3 AS road_km
         FROM districts d, nurseries n WHERE d.name = $1 AND n.id = $2`,
        [input.deliveryDistrict, nursery.id, ROAD_FACTOR]
      );
      district = rows[0];
    }
    if (!district) throw badRequest('Choose a delivery district from the list');

    // Lock the batches so concurrent orders cannot both take the same seedlings
    const { rows: batches } = await db.query<{ id: string; species_id: string; seedling_type: string; unit_price_ugx: number; quantity_available: number }>(
      `SELECT id, species_id, seedling_type, unit_price_ugx, quantity_available FROM seedling_batches
       WHERE id = ANY($1::uuid[]) AND nursery_id = $2 ORDER BY id FOR UPDATE`,
      [batchIds, nursery.id]
    );
    if (batches.length !== batchIds.length) throw badRequest('Some seedlings in your cart are no longer listed by this nursery');

    let seedlings = 0;
    let seedlingsTotal = 0;
    for (const item of input.items) {
      const batch = batches.find(b => b.id === item.batchId)!;
      if (item.quantity > batch.quantity_available) {
        throw conflict(`Only ${batch.quantity_available.toLocaleString('en-UG')} of one of your seedlings are left. Update your cart and try again.`, 'insufficient_stock');
      }
      seedlings += item.quantity;
      seedlingsTotal += item.quantity * batch.unit_price_ugx;
    }

    const quote = quoteDelivery(input.deliveryMethod, district.road_km, seedlings);
    if (!quote.available) throw badRequest(quote.note);

    for (const item of input.items) {
      await db.query('UPDATE seedling_batches SET quantity_available = quantity_available - $2 WHERE id = $1', [item.batchId, item.quantity]);
    }

    const { rows: [order] } = await db.query<{ id: string; order_number: string; total_ugx: number }>(
      `INSERT INTO orders (order_number, buyer_id, buyer_name, buyer_phone, nursery_id, delivery_method, delivery_district_id,
                           delivery_area, delivery_landmark, distance_km, seedlings_total_ugx, delivery_fee_ugx, total_ugx, delivery_code)
       VALUES ('NL-' || to_char(now(), 'YYYY') || '-' || nextval('order_number_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, order_number, total_ugx`,
      [buyer.id, input.buyerName, buyer.phone, nursery.id, input.deliveryMethod, district.id,
        isCollection ? '' : input.deliveryArea, isCollection ? '' : input.deliveryLandmark,
        quote.distanceKm, seedlingsTotal, quote.feeUGX, seedlingsTotal + quote.feeUGX, randomDigits(4)]
    );

    for (const item of input.items) {
      const batch = batches.find(b => b.id === item.batchId)!;
      await db.query(
        `INSERT INTO order_items (order_id, batch_id, species_id, seedling_type, quantity, unit_price_ugx) VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, batch.id, batch.species_id, batch.seedling_type, item.quantity, batch.unit_price_ugx]
      );
    }
    await db.query(`INSERT INTO order_events (order_id, status, actor_id) VALUES ($1, 'awaiting_payment', $2)`, [order.id, buyer.id]);

    const provider = providerForNetwork(input.paymentNetwork);
    const { rows: [payment] } = await db.query<{ id: string; reference: string }>(
      `INSERT INTO payments (order_id, direction, provider, network, phone, amount_ugx)
       VALUES ($1, 'collection', $2, $3, $4, $5) RETURNING id, reference`,
      [order.id, provider.name, input.paymentNetwork, input.paymentPhone, order.total_ugx]
    );

    return { order, payment, provider };
  });

  // Ask the provider only after the reservation is committed; a failure releases the stock again
  try {
    const result = await created.provider.requestPayment({
      reference: created.payment.reference,
      amountUGX: created.order.total_ugx,
      phone: input.paymentPhone,
      message: `Nursery Link order ${created.order.order_number}`,
    });
    await query('UPDATE payments SET provider_reference = $2, provider_response = $3 WHERE id = $1',
      [created.payment.id, result.providerReference ?? null, JSON.stringify(result.raw ?? null)]);
  } catch (err) {
    const reason = err instanceof ProviderError ? err.message : 'Could not reach the payment provider';
    await applyCollectionResult(created.payment.id, { status: 'failed', reason, raw: err instanceof ProviderError ? err.raw : undefined });
  }

  return created.order.id;
};

// ── Payment results ────────────────────────────────────────

/**
 * Records the outcome of a buyer's payment. Safe to call more than once (callbacks and polling
 * may both report the same result): only the first call for a pending payment has any effect.
 */
export const applyCollectionResult = async (paymentId: string, result: ProviderStatus) => {
  if (result.status === 'pending') return;

  const outcome = await withTransaction(async db => {
    const { rows: [payment] } = await db.query<{ id: string; order_id: string; status: string; phone: string; network: PaymentNetwork; amount_ugx: number }>(
      `SELECT id, order_id, status, phone, network, amount_ugx FROM payments WHERE id = $1 AND direction = 'collection' FOR UPDATE`,
      [paymentId]
    );
    if (!payment || payment.status !== 'pending') return null;

    await db.query(
      `UPDATE payments SET status = $2, failure_reason = $3, provider_reference = COALESCE($4, provider_reference),
                           provider_response = COALESCE($5, provider_response) WHERE id = $1`,
      [payment.id, result.status, result.reason ?? null, result.providerReference ?? null, result.raw === undefined ? null : JSON.stringify(result.raw)]
    );

    const { rows: [order] } = await db.query<{ id: string; status: OrderStatus }>('SELECT id, status FROM orders WHERE id = $1 FOR UPDATE', [payment.order_id]);

    if (result.status === 'successful') {
      if (order.status === 'awaiting_payment') {
        await transition(db, order.id, ['awaiting_payment'], 'payment_held', null, 'Payment approved', ', paid_at = now()');
        return { kind: 'paid' as const, orderId: order.id };
      }
      // Money arrived after the order had already expired or been cancelled: send it back
      return { kind: 'late' as const, orderId: order.id, payment };
    }

    if (order.status === 'awaiting_payment') {
      await transition(db, order.id, ['awaiting_payment'], 'payment_failed', null, result.reason ?? 'Payment failed');
      await restoreStock(db, order.id);
    }
    return null;
  });

  if (outcome?.kind === 'paid') await notifyPaid(outcome.orderId);
  if (outcome?.kind === 'late') {
    await startPayout(outcome.orderId, 'refund', outcome.payment.phone, outcome.payment.network, outcome.payment.amount_ugx);
  }
};

const notifyPaid = async (orderId: string) => {
  const { rows: [o] } = await query<{ order_number: string; buyer_phone: string; delivery_code: string; total_ugx: number; nursery_phone: string; seedlings: number; delivery_method: string }>(
    `SELECT o.order_number, o.buyer_phone, o.delivery_code, o.total_ugx, n.phone AS nursery_phone, o.delivery_method,
            (SELECT sum(quantity) FROM order_items WHERE order_id = o.id)::int AS seedlings
     FROM orders o JOIN nurseries n ON n.id = o.nursery_id WHERE o.id = $1`,
    [orderId]
  );
  const handover = o.delivery_method === 'Collect from nursery' ? 'the nursery' : 'the rider';
  await sendSms(o.buyer_phone, `Payment of ${formatUGX(o.total_ugx)} received for order ${o.order_number}. Your delivery code is ${o.delivery_code}. Give it to ${handover} only after checking your seedlings.`);
  await sendSms(o.nursery_phone, `New order ${o.order_number}: ${o.seedlings.toLocaleString('en-UG')} seedlings, ${formatUGX(o.total_ugx)} held for you. Sign in to Nursery Link to prepare it.`);
};

// ── Payouts and refunds ────────────────────────────────────

const startPayout = async (orderId: string, purpose: 'nursery' | 'refund', phone: string, network: PaymentNetwork, amount: number) => {
  const provider = providerForNetwork(network);
  const { rows: [payment] } = await query<{ id: string; reference: string; order_number: string }>(
    `INSERT INTO payments (order_id, direction, provider, network, phone, amount_ugx)
     SELECT $1, 'payout', $2, $3, $4, $5
     WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id = $1 AND direction = 'payout' AND status <> 'failed')
     RETURNING id, reference, (SELECT order_number FROM orders WHERE id = $1)`,
    [orderId, provider.name, network, phone, amount]
  );
  if (!payment) return; // a payout for this order is already under way

  try {
    const result = await provider.sendPayout({
      reference: payment.reference,
      amountUGX: amount,
      phone,
      message: purpose === 'refund' ? `Refund for Nursery Link order ${payment.order_number}` : `Payment for Nursery Link order ${payment.order_number}`,
    });
    await query('UPDATE payments SET provider_reference = $2, provider_response = $3 WHERE id = $1',
      [payment.id, result.providerReference ?? null, JSON.stringify(result.raw ?? null)]);
    await applyPayoutResult(payment.id, await provider.getPayoutStatus(payment.reference));
  } catch (err) {
    // Left pending/failed for the background worker or an admin to retry; never lose track of money owed
    console.error(`Payout ${payment.id} failed to start:`, err);
    await query(`UPDATE payments SET status = 'failed', failure_reason = $2 WHERE id = $1 AND status = 'pending'`,
      [payment.id, err instanceof Error ? err.message : 'Payout failed']);
  }
};

export const applyPayoutResult = async (paymentId: string, result: ProviderStatus) => {
  if (result.status === 'pending') return;
  const { rows: [p] } = await query<{ phone: string; amount_ugx: number }>(
    `UPDATE payments SET status = $2, failure_reason = $3, provider_reference = COALESCE($4, provider_reference)
     WHERE id = $1 AND direction = 'payout' AND status = 'pending' RETURNING phone, amount_ugx`,
    [paymentId, result.status, result.reason ?? null, result.providerReference ?? null]
  );
  if (p && result.status === 'successful') {
    await sendSms(p.phone, `${formatUGX(p.amount_ugx)} has been sent to your Mobile Money by Nursery Link.`);
  }
};

/** Retries a failed payout for an order (admin action). */
export const retryPayout = async (orderId: string) => {
  const { rows: [last] } = await query<{ phone: string; network: PaymentNetwork; amount_ugx: number; status: string }>(
    `SELECT phone, network, amount_ugx, status FROM payments WHERE order_id = $1 AND direction = 'payout' ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  if (!last || last.status !== 'failed') throw badRequest('There is no failed payout to retry for this order');
  const { rows: [order] } = await query<{ status: OrderStatus }>('SELECT status FROM orders WHERE id = $1', [orderId]);
  await startPayout(orderId, order.status === 'cancelled' ? 'refund' : 'nursery', last.phone, last.network, last.amount_ugx);
};

// ── Order actions ──────────────────────────────────────────

export const advanceByNursery = async (orderId: string, actorId: string, to: 'being_prepared' | 'on_the_way') => {
  const from: OrderStatus = to === 'being_prepared' ? 'payment_held' : 'being_prepared';
  await withTransaction(db => transition(db, orderId, [from], to, actorId));

  if (to === 'on_the_way') {
    const { rows: [o] } = await query<{ buyer_phone: string; order_number: string; delivery_method: string; nursery_name: string }>(
      `SELECT o.buyer_phone, o.order_number, o.delivery_method, n.name AS nursery_name FROM orders o JOIN nurseries n ON n.id = o.nursery_id WHERE o.id = $1`,
      [orderId]
    );
    await sendSms(o.buyer_phone, o.delivery_method === 'Collect from nursery'
      ? `Order ${o.order_number} is ready for collection at ${o.nursery_name}. Bring your delivery code.`
      : `Order ${o.order_number} is on the way from ${o.nursery_name}. Check your seedlings before giving the rider your delivery code.`);
  }
};

/** Marks an order delivered and pays the nursery. Buyers confirm directly; nurseries must supply the buyer's code. */
export const confirmDelivery = async (orderId: string, actorId: string, deliveryCode?: string) => {
  const order = await withTransaction(async db => {
    const { rows: [o] } = await db.query<{ delivery_code: string; total_ugx: number; payout_phone: string; payout_network: PaymentNetwork }>(
      `SELECT o.delivery_code, o.total_ugx, n.payout_phone, n.payout_network
       FROM orders o JOIN nurseries n ON n.id = o.nursery_id WHERE o.id = $1 FOR UPDATE OF o`,
      [orderId]
    );
    if (!o) throw notFound('Order not found');
    if (deliveryCode !== undefined && deliveryCode !== o.delivery_code) {
      throw badRequest('That code does not match. Ask the buyer to check the code in their order.', 'wrong_delivery_code');
    }
    await transition(db, orderId, ['on_the_way'], 'delivered', actorId, deliveryCode ? 'Confirmed by nursery with delivery code' : 'Confirmed by buyer', ', delivered_at = now()');
    return o;
  });
  await startPayout(orderId, 'nursery', order.payout_phone, order.payout_network, order.total_ugx);
};

export const reportProblem = async (orderId: string, actorId: string, note: string) => {
  await withTransaction(db => transition(db, orderId, ['payment_held', 'being_prepared', 'on_the_way'], 'problem_reported', actorId, note));
};

export const cancelUnpaidOrder = async (orderId: string, actorId: string) => {
  await withTransaction(async db => {
    await db.query(`UPDATE payments SET status = 'failed', failure_reason = 'Cancelled by buyer' WHERE order_id = $1 AND direction = 'collection' AND status = 'pending'`, [orderId]);
    await transition(db, orderId, ['awaiting_payment'], 'cancelled', actorId, 'Cancelled before payment');
    await restoreStock(db, orderId);
  });
};

/** Admin decision on a disputed order: pay the nursery, or refund the buyer and return the stock. */
export const resolveDispute = async (orderId: string, actorId: string, action: 'release' | 'refund', note: string) => {
  if (action === 'release') {
    const o = await withTransaction(async db => {
      await transition(db, orderId, ['problem_reported'], 'delivered', actorId, note, ', delivered_at = now()');
      const { rows: [row] } = await db.query<{ total_ugx: number; payout_phone: string; payout_network: PaymentNetwork }>(
        'SELECT o.total_ugx, n.payout_phone, n.payout_network FROM orders o JOIN nurseries n ON n.id = o.nursery_id WHERE o.id = $1', [orderId]);
      return row;
    });
    await startPayout(orderId, 'nursery', o.payout_phone, o.payout_network, o.total_ugx);
    return;
  }

  const collection = await withTransaction(async db => {
    await transition(db, orderId, ['problem_reported', 'payment_held', 'being_prepared'], 'cancelled', actorId, note);
    await restoreStock(db, orderId);
    const { rows: [p] } = await db.query<{ phone: string; network: PaymentNetwork; amount_ugx: number }>(
      `SELECT phone, network, amount_ugx FROM payments WHERE order_id = $1 AND direction = 'collection' AND status = 'successful'`, [orderId]);
    return p;
  });
  if (collection) await startPayout(orderId, 'refund', collection.phone, collection.network, collection.amount_ugx);
};

// ── Background work ────────────────────────────────────────

/** Checks pending payments with the provider and expires unpaid orders. Run every few seconds. */
export const processPendingPayments = async () => {
  const { rows: pending } = await pool.query<{ id: string; reference: string; provider: 'simulated' | 'mtn_momo' | 'airtel_money'; direction: 'collection' | 'payout'; expired: boolean }>(
    `SELECT id, reference, provider, direction, created_at < now() - make_interval(mins => $1) AS expired
     FROM payments WHERE status = 'pending' AND created_at < now() - interval '5 seconds' ORDER BY created_at LIMIT 50`,
    [PAYMENT_TIMEOUT_MINUTES]
  );

  for (const p of pending) {
    try {
      const provider = providerByName(p.provider);
      const status = p.direction === 'collection' ? await provider.getPaymentStatus(p.reference) : await provider.getPayoutStatus(p.reference);
      if (p.direction === 'payout') {
        await applyPayoutResult(p.id, status);
      } else if (status.status !== 'pending') {
        await applyCollectionResult(p.id, status);
      } else if (p.expired) {
        await applyCollectionResult(p.id, { status: 'failed', reason: `Not approved within ${PAYMENT_TIMEOUT_MINUTES} minutes` });
      }
    } catch (err) {
      console.error(`Could not check payment ${p.id}:`, err instanceof Error ? err.message : err);
    }
  }
};
