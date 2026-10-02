import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import type { OrderStatus } from '@nurserylink/shared';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue, type JobName } from '../../jobs/queue.js';
import { jobHandlers } from '../../jobs/worker.js';
import { buildServices } from '../../services.js';
import { adminToken, bearer, newBuyer } from '../../../test/auth.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { errorOf } from '../../../test/http.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';
import { nurseryOrderSms } from './notifications.js';
import type { OrderDto, QuoteResult } from './orders.service.js';

const pool = createPool(inject('databaseUrl'));
const providers = mockProviders();
const queue = new RecordingQueue();
const logger = pino({ level: 'silent' });
const config = testConfig(inject('databaseUrl'));
const deps = { config, pool, logger, providers, queue };
const services = buildServices(deps);
const app = createApp(deps, services);
const handlers = jobHandlers(services, logger);

const PAYER = '+256772123456';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a response body in tests
const data = <T>(res: request.Response) => (res.body as { data: T }).data;

/** Runs queued jobs (and any jobs they queue) until the queue is empty. */
const drainJobs = async (only?: JobName[]) => {
  for (let round = 0; round < 20; round++) {
    const next = queue.jobs.find(j => !only || only.includes(j.name));
    if (!next) return;
    queue.jobs.splice(queue.jobs.indexOf(next), 1);
    await (handlers[next.name] as (d: unknown) => Promise<void>)(next.data);
  }
  throw new Error('Jobs kept queueing more jobs');
};

let admin: Record<string, string>;
let buyer: { headers: Record<string, string>; userId: string; phone: string };
let otherBuyer: Record<string, string>;
let line: { inventory_id: string; nursery_id: string; species_id: string; unit_price: number; original_quantity: number; contact_phone: string; lat: number; lng: number };

const setStock = (quantity: number) => pool.query('UPDATE inventory SET quantity_available = $1 WHERE id = $2', [quantity, line.inventory_id]);
const stock = async () => (await pool.query<{ q: number }>('SELECT quantity_available AS q FROM inventory WHERE id = $1', [line.inventory_id])).rows[0]?.q;
const orderStatus = async (id: string) => (await pool.query<{ status: OrderStatus }>('SELECT status FROM orders WHERE id = $1', [id])).rows[0]?.status;
const auditActions = async (entityId: string) =>
  (await pool.query<{ action: string }>('SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY id', [entityId])).rows.map(r => r.action);

beforeAll(async () => {
  await prepareTestDatabase(pool);
  admin = bearer(await adminToken(app));
  const b = await newBuyer(app, providers.sms);
  buyer = { headers: bearer(b.token), userId: b.userId, phone: b.phone };
  otherBuyer = bearer((await newBuyer(app, providers.sms)).token);

  const { rows } = await pool.query<typeof line>(`
    SELECT i.id AS inventory_id, i.nursery_id, i.species_id, i.unit_price, i.quantity_available AS original_quantity,
           n.contact_phone, ST_Y(n.location) AS lat, ST_X(n.location) AS lng
    FROM inventory i JOIN nurseries n ON n.id = i.nursery_id
    WHERE n.is_active ORDER BY n.name, i.id LIMIT 1`);
  if (!rows[0]) throw new Error('No seeded inventory');
  line = rows[0];
});

afterAll(async () => {
  await pool.query('UPDATE inventory SET quantity_available = $1 WHERE id = $2', [line.original_quantity, line.inventory_id]);
  await pool.end();
});

beforeEach(async () => {
  queue.jobs.length = 0;
  await setStock(100);
});

const quote = (quantity: number, headers = buyer.headers, extra: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/v1/orders/quote')
    .set(headers)
    .send({ nursery_id: line.nursery_id, items: [{ inventory_id: line.inventory_id, quantity }], delivery_type: 'self_pickup', ...extra });

const placeOrder = async (quantity: number) => {
  const q = data<QuoteResult>(await quote(quantity).expect(200));
  const res = await request(app).post('/api/v1/orders').set(buyer.headers).send({ quote_token: q.quote_token, payment_method: 'mtn_momo', payer_phone: '0772123456' });
  expect(res.status).toBe(201);
  return data<OrderDto>(res);
};

const collectionRef = async (orderId: string) => {
  const { rows } = await pool.query<{ provider_ref: string }>(`SELECT provider_ref FROM payments WHERE order_id = $1 AND kind = 'collection'`, [orderId]);
  const ref = rows[0]?.provider_ref;
  if (!ref) throw new Error('No collection reference');
  return ref;
};

/** The buyer approves (or declines) the prompt, and the provider calls our webhook. */
const settleCollection = async (orderId: string, status: 'successful' | 'failed') => {
  const ref = await collectionRef(orderId);
  providers.payment.settle(ref, status);
  return request(app).post('/api/v1/webhooks/payments/mock').send({ reference: ref, status }).expect(200);
};

const nurseryReply = (text: string, from = line.contact_phone) =>
  request(app).post('/api/v1/webhooks/sms/inbound').type('form').send({ from, text }).expect(200);

describe('POST /orders/quote', () => {
  it('prices a pickup order from live stock', async () => {
    const q = data<QuoteResult>(await quote(10).expect(200));
    expect(q.items_total).toBe(10 * line.unit_price);
    expect(q.delivery).toMatchObject({ type: 'self_pickup', fee: 0 });
    expect(q.grand_total).toBe(q.items_total);
    expect(q.quote_token.length).toBeGreaterThan(20);
  });

  it('prices delivery by road distance with the cheapest fitting rate', async () => {
    const point = { lat: line.lat + 0.03, lng: line.lng };
    const q = data<QuoteResult>(await quote(20, buyer.headers, { delivery_type: 'order_and_deliver', delivery_point: point }).expect(200));
    expect(q.delivery.vehicle).toBe('motorcycle');
    expect(q.delivery.distance_km).toBeGreaterThan(3);
    expect(q.delivery.fee).toBe(5000 + 1500 * Math.ceil(q.delivery.distance_km ?? 0));
    expect(q.grand_total).toBe(q.items_total + q.delivery.fee);
  });

  it('switches to a truck above 300 seedlings, and refuses beyond every rate', async () => {
    await setStock(30000);
    const point = { lat: line.lat + 0.03, lng: line.lng };
    const big = data<QuoteResult>(await quote(301, buyer.headers, { delivery_type: 'order_and_deliver', delivery_point: point }).expect(200));
    expect(big.delivery.vehicle).toBe('truck');
    const tooBig = await quote(25000, buyer.headers, { delivery_type: 'order_and_deliver', delivery_point: point }).expect(400);
    expect(errorOf(tooBig).details).toMatchObject({ reason: 'too_many_items' });
    const tooFar = await quote(10, buyer.headers, { delivery_type: 'order_and_deliver', delivery_point: { lat: 3.5, lng: 32.5 } }).expect(400);
    expect(errorOf(tooFar).details).toMatchObject({ reason: 'too_far' });
  });

  it('rejects more than is in stock, and items from another nursery', async () => {
    await setStock(5);
    expect(errorOf(await quote(6).expect(409)).details).toEqual([expect.objectContaining({ available: 5 })]);
    const { rows } = await pool.query<{ id: string }>('SELECT id FROM inventory WHERE nursery_id <> $1 LIMIT 1', [line.nursery_id]);
    await request(app)
      .post('/api/v1/orders/quote')
      .set(buyer.headers)
      .send({ nursery_id: line.nursery_id, items: [{ inventory_id: rows[0]?.id, quantity: 1 }], delivery_type: 'self_pickup' })
      .expect(400);
  });

  it('requires a delivery point for delivery', async () => {
    await quote(1, buyer.headers, { delivery_type: 'order_and_deliver' }).expect(400);
  });
});

describe('POST /orders', () => {
  it('takes the stock, records a pending payment and prompts the payer', async () => {
    const order = await placeOrder(7);
    expect(order).toMatchObject({ status: 'pending_payment', grand_total: 7 * line.unit_price, payment: { status: 'pending', msisdn: PAYER } });
    expect(order.short_code).toMatch(/^[A-Z0-9]{6}$/);
    expect(await stock()).toBe(93);
    expect(providers.payment.lastCollection()).toMatchObject({ msisdn: PAYER, amount: order.grand_total });
    expect(queue.jobs.find(j => j.name === 'payment-timeout')?.options.startAfterSeconds).toBe(900);
    expect(await auditActions(order.id)).toEqual(['order.created']);
  });

  it('refuses to reuse a quote', async () => {
    const q = data<QuoteResult>(await quote(1).expect(200));
    const body = { quote_token: q.quote_token, payment_method: 'mtn_momo', payer_phone: '0772123456' };
    await request(app).post('/api/v1/orders').set(buyer.headers).send(body).expect(201);
    await request(app).post('/api/v1/orders').set(buyer.headers).send(body).expect(409);
  });

  it("refuses another buyer's quote, a forged token, and a price change since quoting", async () => {
    const q = data<QuoteResult>(await quote(1).expect(200));
    const body = { quote_token: q.quote_token, payment_method: 'mtn_momo', payer_phone: '0772123456' };
    await request(app).post('/api/v1/orders').set(otherBuyer).send(body).expect(403);
    await request(app).post('/api/v1/orders').set(buyer.headers).send({ ...body, quote_token: `${q.quote_token.slice(0, -4)}AAAA` }).expect(400);

    await pool.query('UPDATE inventory SET unit_price = unit_price + 100 WHERE id = $1', [line.inventory_id]);
    try {
      const res = await request(app).post('/api/v1/orders').set(buyer.headers).send(body).expect(409);
      expect(errorOf(res).details).toEqual([expect.objectContaining({ reason: 'price_changed' })]);
    } finally {
      await pool.query('UPDATE inventory SET unit_price = $1 WHERE id = $2', [line.unit_price, line.inventory_id]);
    }
    expect(await stock()).toBe(100);
  });

  it('enforces FR-25: delivery needs an address, and the number must match the network', async () => {
    const q = data<QuoteResult>(await quote(1, buyer.headers, { delivery_type: 'order_and_deliver', delivery_point: { lat: line.lat + 0.01, lng: line.lng } }).expect(200));
    await request(app).post('/api/v1/orders').set(buyer.headers).send({ quote_token: q.quote_token, payment_method: 'mtn_momo', payer_phone: '0772123456' }).expect(400);
    const mismatch = await request(app)
      .post('/api/v1/orders')
      .set(buyer.headers)
      .send({ quote_token: q.quote_token, delivery_address: 'Opposite Seeta market', payment_method: 'mtn_momo', payer_phone: '0701234567' })
      .expect(400);
    expect(errorOf(mismatch).details).toMatchObject({ path: 'payer_phone' });
  });

  it('never oversells: 10 parallel orders for 5 seedlings, exactly 5 succeed', async () => {
    await setStock(5);
    const quotes = await Promise.all(Array.from({ length: 10 }, async () => data<QuoteResult>(await quote(1).expect(200))));
    const results = await Promise.all(
      quotes.map(q => request(app).post('/api/v1/orders').set(buyer.headers).send({ quote_token: q.quote_token, payment_method: 'mtn_momo', payer_phone: '0772123456' }))
    );
    expect(results.filter(r => r.status === 201)).toHaveLength(5);
    expect(results.filter(r => r.status === 409)).toHaveLength(5);
    expect(await stock()).toBe(0);
  });

  it('cancels the order and returns the stock when the provider is down', async () => {
    const q = data<QuoteResult>(await quote(4).expect(200));
    providers.payment.setUnavailable(true);
    try {
      const res = await request(app).post('/api/v1/orders').set(buyer.headers).send({ quote_token: q.quote_token, payment_method: 'mtn_momo', payer_phone: '0772123456' }).expect(503);
      const { order_id } = errorOf(res).details as { order_id: string };
      expect(await orderStatus(order_id)).toBe('cancelled');
    } finally {
      providers.payment.setUnavailable(false);
    }
    expect(await stock()).toBe(100);
  });
});

describe('order lifecycle', () => {
  it('quote → order → paid → nursery SMS → dispatched → confirmed → released', async () => {
    const order = await placeOrder(10);
    await settleCollection(order.id, 'successful');
    expect(await orderStatus(order.id)).toBe('escrow_held');

    // The nursery SMS: exact format, a map link and no coordinates
    await drainJobs(['sms-send']);
    const sms = providers.sms.lastTo(line.contact_phone)?.message ?? '';
    const full = (await services.orders.get({ id: buyer.userId, role: 'buyer' }, order.id));
    expect(sms).toMatch(new RegExp(`^NurseryLink order ${order.short_code}: 10 .+\\. Buyer Test Buyer \\+2567\\d{8}\\. Map: http://localhost:5173/o/${order.short_code}\\?k=[\\w-]{12}\\. Reply ${order.short_code} 1=dispatched 2=out of stock$`));
    expect(sms).not.toMatch(/\d+\.\d{3,}/);
    expect(full.paid_at).not.toBeNull();
    expect(providers.sms.lastTo(PAYER)).toBeUndefined();
    expect(providers.sms.lastTo(buyer.phone)?.message).toContain(order.short_code);

    expect(data<{ result: string }>(await nurseryReply(`${order.short_code.toLowerCase()} 1`))).toMatchObject({ result: 'dispatched' });
    expect(await orderStatus(order.id)).toBe('dispatched');

    const confirmed = data<OrderDto>(await request(app).put(`/api/v1/orders/${order.id}/confirm-delivery`).set(buyer.headers).expect(200));
    expect(confirmed.status).toBe('delivered');
    await drainJobs(['payout-check']);
    expect(await orderStatus(order.id)).toBe('released');

    const { rows: payouts } = await pool.query<{ msisdn: string; amount: number; status: string }>(
      `SELECT p.msisdn, p.amount, p.status FROM payments p WHERE p.order_id = $1 AND kind = 'disbursement'`, [order.id]);
    const { rows: nursery } = await pool.query<{ payout_phone: string }>('SELECT payout_phone FROM nurseries WHERE id = $1', [line.nursery_id]);
    expect(payouts).toEqual([{ msisdn: nursery[0]?.payout_phone, amount: order.grand_total, status: 'successful' }]);
    expect(await auditActions(order.id)).toEqual(['order.created', 'order.status_changed', 'order.status_changed', 'order.status_changed', 'order.status_changed']);
    expect(await stock()).toBe(90);
  });

  it('a failed payment cancels the order and restores the stock', async () => {
    const order = await placeOrder(12);
    expect(await stock()).toBe(88);
    await settleCollection(order.id, 'failed');
    expect(await orderStatus(order.id)).toBe('cancelled');
    expect(await stock()).toBe(100);
  });

  it('ignores duplicate payment webhooks', async () => {
    const order = await placeOrder(3);
    const first = await settleCollection(order.id, 'successful');
    const second = await settleCollection(order.id, 'successful');
    expect(data<{ result: string }>(first).result).toBe('applied');
    expect(data<{ result: string }>(second).result).toBe('duplicate');
    expect(queue.jobs.filter(j => j.name === 'sms-send')).toHaveLength(2);
    expect((await auditActions(order.id)).filter(a => a === 'order.status_changed')).toHaveLength(1);
  });

  it('takes the outcome from the provider, not from the webhook body', async () => {
    const order = await placeOrder(2);
    const ref = await collectionRef(order.id);
    const res = await request(app).post('/api/v1/webhooks/payments/mock').send({ reference: ref, status: 'SUCCESSFUL' }).expect(200);
    expect(data<{ result: string }>(res).result).toBe('pending');
    expect(await orderStatus(order.id)).toBe('pending_payment');
  });

  it('times out unpaid orders after 15 minutes, and refunds money that arrives later', async () => {
    const order = await placeOrder(6);
    await drainJobs(['payment-timeout']);
    expect(await orderStatus(order.id)).toBe('cancelled');
    expect(await stock()).toBe(100);

    // The buyer approves the prompt after the order was cancelled: the money goes back
    expect(data<{ result: string }>(await settleCollection(order.id, 'successful')).result).toBe('applied');
    expect(data<{ result: string }>(await settleCollection(order.id, 'successful')).result).toBe('duplicate');
    await drainJobs(['payout-check', 'sms-send']);
    const { rows } = await pool.query<{ kind: string; status: string; msisdn: string }>(`SELECT kind, status, msisdn FROM payments WHERE order_id = $1 ORDER BY created_at`, [order.id]);
    expect(rows).toEqual([
      { kind: 'collection', status: 'successful', msisdn: PAYER },
      { kind: 'refund', status: 'successful', msisdn: PAYER },
    ]);
    expect(await orderStatus(order.id)).toBe('cancelled');
  });

  it('auto-releases orders dispatched more than 72 hours ago', async () => {
    const order = await placeOrder(1);
    await settleCollection(order.id, 'successful');
    await nurseryReply(`${order.short_code} 1`);
    await pool.query(`UPDATE orders SET dispatched_at = now() - interval '73 hours' WHERE id = $1`, [order.id]);
    await handlers['auto-release']({});
    await drainJobs(['payout-check']);
    expect(await orderStatus(order.id)).toBe('released');
  });

  it('retries a failed payout 3 times, flags it, and lets an admin retry', async () => {
    const order = await placeOrder(2);
    await settleCollection(order.id, 'successful');
    await nurseryReply(`${order.short_code} 1`);
    providers.payment.failNextDisbursements(3);
    await request(app).put(`/api/v1/orders/${order.id}/confirm-delivery`).set(buyer.headers).expect(200);
    await drainJobs(['payout-check']);
    expect(await orderStatus(order.id)).toBe('delivered');
    expect(await auditActions(order.id)).toContain('payout.flagged');

    const failed = data<{ id: string; order_id: string; attempts: number }[]>(await request(app).get('/api/v1/admin/payouts?status=failed').set(admin).expect(200));
    const mine = failed.filter(p => p.order_id === order.id);
    expect(mine).toHaveLength(3);
    expect(mine[0]?.attempts).toBe(3);

    await request(app).post(`/api/v1/admin/payouts/${mine[0]?.id ?? ''}/retry`).set(admin).expect(200);
    await drainJobs(['payout-check']);
    expect(await orderStatus(order.id)).toBe('released');
    await request(app).post(`/api/v1/admin/payouts/${mine[1]?.id ?? ''}/retry`).set(admin).expect(409);
  });
});

describe("the nursery's order map (link in the SMS)", () => {
  it('opens with the key from the SMS, and gives nothing away without it', async () => {
    const order = await placeOrder(4);
    await settleCollection(order.id, 'successful');
    await drainJobs(['sms-send']);
    const sms = providers.sms.lastTo(line.contact_phone)?.message ?? '';
    const link = new URL(/Map: (\S+)\. Reply/.exec(sms)?.[1] ?? 'http://x');
    const key = link.searchParams.get('k') ?? '';
    expect(link.pathname).toBe(`/o/${order.short_code}`);

    const res = await request(app).get(`/api/v1/orders/by-code/${order.short_code}?k=${key}`).expect(200);
    expect(data(res)).toMatchObject({
      short_code: order.short_code,
      status: 'escrow_held',
      delivery_type: 'self_pickup',
      items: [expect.objectContaining({ quantity: 4 })],
      buyer: { full_name: 'Test Buyer', phone: buyer.phone },
    });
    // Same answer for a wrong key and a code that doesn't exist: no way to probe for codes
    const wrongKey = await request(app).get(`/api/v1/orders/by-code/${order.short_code}?k=AAAAAAAAAAAA`).expect(404);
    const wrongCode = await request(app).get(`/api/v1/orders/by-code/ZZZZZ9?k=${key}`).expect(404);
    expect(errorOf(wrongKey)).toEqual(errorOf(wrongCode));
    // Typed in lower case from the SMS still works
    await request(app).get(`/api/v1/orders/by-code/${order.short_code.toLowerCase()}?k=${key}`).expect(200);
  });
});

describe('nursery SMS replies', () => {
  it('"2" (out of stock) disputes the order and flags it for an admin', async () => {
    const order = await placeOrder(1);
    await settleCollection(order.id, 'successful');
    expect(data<{ result: string }>(await nurseryReply(`${order.short_code} 2`)).result).toBe('disputed');
    expect(await orderStatus(order.id)).toBe('disputed');
    expect(await auditActions(order.id)).toContain('order.flagged');
  });

  it('ignores replies from other phones, unknown codes and free text, logging each for an admin', async () => {
    const order = await placeOrder(1);
    await settleCollection(order.id, 'successful');
    expect(data<{ result: string }>(await nurseryReply(`${order.short_code} 1`, '+256772999999')).result).toBe('ignored');
    expect(data<{ result: string }>(await nurseryReply('ZZZZZ9 1')).result).toBe('ignored');
    expect(data<{ result: string }>(await nurseryReply('Will deliver tomorrow')).result).toBe('ignored');
    expect(await orderStatus(order.id)).toBe('escrow_held');
    const { rows } = await pool.query<{ reason: string }>(`SELECT after->>'reason' AS reason FROM audit_log WHERE action = 'sms.unrecognised' ORDER BY id DESC LIMIT 3`);
    expect(rows.map(r => r.reason).sort()).toEqual(['sender is not the nursery', 'unknown order code', 'unrecognised text']);
  });

  it('does not dispatch an order that has not been paid', async () => {
    const order = await placeOrder(1);
    expect(data<{ result: string }>(await nurseryReply(`${order.short_code} 1`)).result).toBe('ignored');
    expect(await orderStatus(order.id)).toBe('pending_payment');
  });
});

describe('buyer order views', () => {
  it('lists my orders and hides other buyers orders', async () => {
    const order = await placeOrder(1);
    const mine = await request(app).get('/api/v1/orders/me').set(buyer.headers).expect(200);
    expect(data<OrderDto[]>(mine).map(o => o.id)).toContain(order.id);
    expect((mine.body as { meta: { total: number } }).meta.total).toBeGreaterThan(0);
    await request(app).get(`/api/v1/orders/${order.id}`).set(buyer.headers).expect(200);
    await request(app).get(`/api/v1/orders/${order.id}`).set(otherBuyer).expect(404);
    await request(app).get(`/api/v1/orders/${order.id}`).set(admin).expect(200);
    await request(app).put(`/api/v1/orders/${order.id}/confirm-delivery`).set(otherBuyer).expect(404);
    await request(app).put(`/api/v1/orders/${order.id}/confirm-delivery`).set(buyer.headers).expect(409);
  });
});

describe('admin order management', () => {
  it('filters orders by status', async () => {
    const order = await placeOrder(1);
    const res = await request(app).get('/api/v1/admin/orders?status=pending_payment').set(admin).expect(200);
    const rows = data<(OrderDto & { buyer: { id: string } })[]>(res);
    expect(rows.every(o => o.status === 'pending_payment')).toBe(true);
    expect(rows.find(o => o.id === order.id)?.buyer.id).toBe(buyer.userId);
  });

  it('refunds a paid order to the number that paid, with a required reason', async () => {
    const order = await placeOrder(3);
    await settleCollection(order.id, 'successful');
    await request(app).post(`/api/v1/admin/orders/${order.id}/refund`).set(admin).send({}).expect(400);
    const res = await request(app).post(`/api/v1/admin/orders/${order.id}/refund`).set(admin).send({ reason: 'Nursery cannot supply' }).expect(200);
    expect(data<OrderDto>(res).status).toBe('disputed');
    await drainJobs(['payout-check']);
    expect(await orderStatus(order.id)).toBe('refunded');
    const { rows } = await pool.query<{ msisdn: string; amount: number }>(`SELECT msisdn, amount FROM payments WHERE order_id = $1 AND kind = 'refund'`, [order.id]);
    expect(rows).toEqual([{ msisdn: PAYER, amount: order.grand_total }]);
    await request(app).post(`/api/v1/admin/orders/${order.id}/refund`).set(admin).send({ reason: 'Second attempt' }).expect(409);
  });

  it('resolves a dispute by dispatching, then releasing', async () => {
    const order = await placeOrder(1);
    await settleCollection(order.id, 'successful');
    await nurseryReply(`${order.short_code} 2`);
    const body = (status: string) => ({ status, reason: 'Stock found at the second bed' });
    await request(app).put(`/api/v1/admin/orders/${order.id}/status`).set(admin).send(body('dispatched')).expect(200);
    expect(await orderStatus(order.id)).toBe('dispatched');
    await request(app).put(`/api/v1/admin/orders/${order.id}/status`).set(admin).send(body('released')).expect(200);
    await drainJobs(['payout-check']);
    expect(await orderStatus(order.id)).toBe('released');
    await request(app).put(`/api/v1/admin/orders/${order.id}/status`).set(admin).send(body('dispatched')).expect(409);
    const { rows } = await pool.query<{ actor_id: string | null }>(
      `SELECT actor_id FROM audit_log WHERE entity_id = $1 AND action = 'order.status_changed' AND after->>'status' = 'dispatched'`, [order.id]);
    expect(rows.at(-1)?.actor_id).not.toBeNull();
  });

  it('cannot release an unpaid order', async () => {
    const order = await placeOrder(1);
    await request(app).put(`/api/v1/admin/orders/${order.id}/status`).set(admin).send({ status: 'released', reason: 'Testing the guard' }).expect(409);
  });
});

describe('RBAC', () => {
  const id = '00000000-0000-4000-8000-000000000000';
  const routes: [string, string][] = [
    ['post', '/api/v1/orders/quote'],
    ['post', '/api/v1/orders'],
    ['get', '/api/v1/orders/me'],
    ['get', `/api/v1/orders/${id}`],
    ['put', `/api/v1/orders/${id}/confirm-delivery`],
    ['get', '/api/v1/admin/orders'],
    ['put', `/api/v1/admin/orders/${id}/status`],
    ['post', `/api/v1/admin/orders/${id}/refund`],
    ['get', '/api/v1/admin/payouts'],
    ['post', `/api/v1/admin/payouts/${id}/retry`],
  ];
  const call = (method: string, path: string) => (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]?.(path) ?? request(app).get(path);

  it.each(routes)('%s %s requires sign-in', async (method, path) => {
    await call(method, path).expect(401);
  });

  it.each(routes.filter(([, p]) => p.includes('/admin/')))('%s %s is admin-only', async (method, path) => {
    await call(method, path).set(buyer.headers).send({}).expect(403);
  });

  it.each(routes.filter(([m, p]) => !p.includes('/admin/') && (m !== 'get')))('%s %s is for buyers, not admins', async (method, path) => {
    await call(method, path).set(admin).send({}).expect(403);
  });

  it('webhooks need no sign-in', async () => {
    await request(app).post('/api/v1/webhooks/payments/mock').send({ reference: 'nothing' }).expect(200);
    await request(app).post('/api/v1/webhooks/payments/paypal').send({}).expect(400);
  });
});

describe('nurseryOrderSms', () => {
  it('matches the specified format exactly', () => {
    const message = nurseryOrderSms(
      {
        short_code: 'K7Q2MX',
        buyer_name: 'Nakato Sarah',
        buyer_phone: '+256772123456',
        items: [
          { inventory_id: 'a', species_id: 'a', slug: 'mvule', common_name: 'Mvule', quantity: 200, unit_price: 1, line_total: 200 },
          { inventory_id: 'b', species_id: 'b', slug: 'musizi', common_name: 'Musizi', quantity: 150, unit_price: 1, line_total: 150 },
        ],
      } as Parameters<typeof nurseryOrderSms>[0],
      'https://nurserylink.ug/o/K7Q2MX?k=abcdefghijkl'
    );
    expect(message).toBe(
      'NurseryLink order K7Q2MX: 200 Mvule, 150 Musizi. Buyer Nakato Sarah +256772123456. Map: https://nurserylink.ug/o/K7Q2MX?k=abcdefghijkl. Reply K7Q2MX 1=dispatched 2=out of stock'
    );
  });
});

