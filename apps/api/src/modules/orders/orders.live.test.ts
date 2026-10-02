import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import type { OrderStatus } from '@nurserylink/shared';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue, type JobName } from '../../jobs/queue.js';
import { jobHandlers } from '../../jobs/worker.js';
import { paymentProviders } from '../../providers/index.js';
import { MockPayment } from '../../providers/payment/mockPayment.js';
import { MtnMomo } from '../../providers/payment/mtnMomo.js';
import { buildServices } from '../../services.js';
import { bearer, newBuyer } from '../../../test/auth.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { errorOf } from '../../../test/http.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';
import type { OrderDto, QuoteResult } from './orders.service.js';

/**
 * Live payment mode end to end, with the real MtnMomo provider talking to a scripted MTN API:
 * request-to-pay, callbacks, polling and transfers all go through MTN's HTTP contract.
 */
class FakeMtnApi {
  readonly collections = new Map<string, { body: Record<string, unknown>; status: string }>();
  readonly transfers = new Map<string, { body: Record<string, unknown>; status: string }>();

  readonly fetch = ((input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const headers = (init.headers ?? {}) as Record<string, string>;
    const reply = (status: number, body?: unknown) => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
    if (url.pathname.endsWith('/token/')) return reply(200, { access_token: 'sandbox-token', expires_in: 3600 });
    if (headers.Authorization !== 'Bearer sandbox-token') return reply(401);

    const ref = headers['X-Reference-Id'] ?? url.pathname.split('/').at(-1) ?? '';
    const store = url.pathname.includes('/collection/') ? this.collections : this.transfers;
    if (init.method === 'POST') {
      if (store.has(ref)) return reply(409, { code: 'RESOURCE_ALREADY_EXIST' });
      // In the sandbox, transfers settle straight away; payment prompts wait for the payer
      store.set(ref, { body: JSON.parse(typeof init.body === 'string' ? init.body : '{}') as Record<string, unknown>, status: store === this.transfers ? 'SUCCESSFUL' : 'PENDING' });
      return reply(202);
    }
    const found = store.get(ref);
    return found ? reply(200, { status: found.status, financialTransactionId: '1234567', externalId: ref }) : reply(404, { code: 'RESOURCE_NOT_FOUND' });
  }) as typeof fetch;
}

const pool = createPool(inject('databaseUrl'));
const mtnApi = new FakeMtnApi();
const base = mockProviders();
const providers = {
  ...base,
  payments: paymentProviders('live', new MockPayment(), {
    mtn_momo: new MtnMomo({
      baseUrl: 'https://sandbox.momodeveloper.mtn.com',
      targetEnvironment: 'sandbox',
      currency: 'EUR',
      collection: { subscriptionKey: 'c', apiUser: 'u', apiKey: 'k' },
      disbursement: { subscriptionKey: 'd', apiUser: 'u', apiKey: 'k' },
      fetchImpl: mtnApi.fetch,
    }),
  }),
};
const queue = new RecordingQueue();
const logger = pino({ level: 'silent' });
const deps = { config: testConfig(inject('databaseUrl'), { PAYMENT_PROVIDER_MODE: 'mock' }), pool, logger, providers, queue };
const services = buildServices(deps);
const app = createApp(deps, services);
const handlers = jobHandlers(services, logger);

const runJobs = async (names: JobName[]) => {
  for (let round = 0; round < 20; round++) {
    const next = queue.jobs.find(j => names.includes(j.name));
    if (!next) return;
    queue.jobs.splice(queue.jobs.indexOf(next), 1);
    await (handlers[next.name] as (d: unknown) => Promise<void>)(next.data);
  }
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a response body in tests
const data = <T>(res: request.Response) => (res.body as { data: T }).data;
const status = async (id: string) => (await pool.query<{ status: OrderStatus }>('SELECT status FROM orders WHERE id = $1', [id])).rows[0]?.status;

let buyer: Record<string, string>;
type Line = { inventory_id: string; nursery_id: string; contact_phone: string; quantity: number };
const lines: Record<'mtnPayout' | 'airtelPayout', Line> = {} as Record<'mtnPayout' | 'airtelPayout', Line>;

const lineFor = async (nursery: string): Promise<Line> => {
  const { rows } = await pool.query<Line>(
    `SELECT i.id AS inventory_id, i.nursery_id, n.contact_phone, i.quantity_available AS quantity
     FROM inventory i JOIN nurseries n ON n.id = i.nursery_id WHERE n.name = $1 ORDER BY i.id LIMIT 1`, [nursery]);
  if (!rows[0]) throw new Error(`No stock for ${nursery}`);
  return rows[0];
};

beforeAll(async () => {
  await prepareTestDatabase(pool);
  buyer = bearer((await newBuyer(app, base.sms)).token);
  lines.mtnPayout = await lineFor('Mukono Town Nursery'); // pays out to an MTN number
  lines.airtelPayout = await lineFor('Kasangalabi Tree Nursery'); // pays out to an Airtel number
  for (const l of Object.values(lines)) await pool.query('UPDATE inventory SET quantity_available = 500 WHERE id = $1', [l.inventory_id]);
});

afterAll(async () => {
  for (const l of Object.values(lines)) await pool.query('UPDATE inventory SET quantity_available = $1 WHERE id = $2', [l.quantity, l.inventory_id]);
  await pool.end();
});

beforeEach(() => {
  queue.jobs.length = 0;
});

/** Quotes 2 seedlings and places the order, expecting `expected` back. */
const order = async (line: Line, expected: number, method = 'mtn_momo', phone = '0772123456'): Promise<request.Response> => {
  const quote = await request(app).post('/api/v1/orders/quote').set(buyer)
    .send({ nursery_id: line.nursery_id, items: [{ inventory_id: line.inventory_id, quantity: 2 }], delivery_type: 'self_pickup' });
  expect(quote.status, JSON.stringify(quote.body)).toBe(200);
  const res = await request(app).post('/api/v1/orders').set(buyer)
    .send({ quote_token: data<QuoteResult>(quote).quote_token, payment_method: method, payer_phone: phone });
  expect(res.status, JSON.stringify(res.body)).toBe(expected);
  return res;
};

describe('live payments with MTN MoMo', () => {
  it('prompts the payer through MTN and confirms payment from an MTN callback', async () => {
    const created = data<OrderDto>(await order(lines.mtnPayout, 201));
    const { rows } = await pool.query<{ provider: string; provider_ref: string; idempotency_key: string }>(
      `SELECT provider, provider_ref, idempotency_key FROM payments WHERE order_id = $1`, [created.id]);
    const payment = rows[0];
    expect(payment?.provider).toBe('mtn_momo');
    expect(payment?.provider_ref).toBe(payment?.idempotency_key);
    expect(mtnApi.collections.get(payment?.provider_ref ?? '')?.body).toMatchObject({
      amount: String(created.grand_total), currency: 'EUR', payer: { partyIdType: 'MSISDN', partyId: '256772123456' },
    });
    expect(queue.jobs.filter(j => j.name === 'payment-poll').map(j => j.options.startAfterSeconds)).toEqual([20, 60, 180]);

    // A callback before the payer approves changes nothing: MTN still says PENDING
    const early = await request(app).post('/api/v1/webhooks/payments/mtn_momo').send({ externalId: payment?.idempotency_key, status: 'SUCCESSFUL' }).expect(200);
    expect(data<{ result: string }>(early).result).toBe('pending');

    // MTN's callback body carries our externalId; the outcome is read back from MTN
    const entry = mtnApi.collections.get(payment?.provider_ref ?? '');
    if (entry) entry.status = 'SUCCESSFUL';
    const cb = await request(app).post('/api/v1/webhooks/payments/mtn_momo').send({ financialTransactionId: '1234567', externalId: payment?.idempotency_key, status: 'SUCCESSFUL' }).expect(200);
    expect(data<{ result: string }>(cb).result).toBe('applied');
    expect(await status(created.id)).toBe('escrow_held');

    // Delivery → transfer to the nursery's MTN payout number → released
    await request(app).post('/api/v1/webhooks/sms/inbound').type('form').send({ from: lines.mtnPayout.contact_phone, text: `${created.short_code} 1` }).expect(200);
    await request(app).put(`/api/v1/orders/${created.id}/confirm-delivery`).set(buyer).expect(200);
    await runJobs(['payout-check']);
    expect(await status(created.id)).toBe('released');
    const transfer = [...mtnApi.transfers.values()].at(-1);
    expect(transfer?.body).toMatchObject({ amount: String(created.grand_total), payee: { partyIdType: 'MSISDN', partyId: '256772100114' } });
  });

  it('confirms payment by polling when no callback arrives', async () => {
    const created = data<OrderDto>(await order(lines.mtnPayout, 201));
    await runJobs(['payment-poll']); // still pending at MTN: nothing happens
    expect(await status(created.id)).toBe('pending_payment');

    const ref = (await pool.query<{ provider_ref: string }>(`SELECT provider_ref FROM payments WHERE order_id = $1`, [created.id])).rows[0]?.provider_ref ?? '';
    const entry = mtnApi.collections.get(ref);
    if (entry) entry.status = 'FAILED';
    queue.jobs.length = 0;
    await services.payments.pollCollection((await pool.query<{ id: string }>(`SELECT id FROM payments WHERE order_id = $1`, [created.id])).rows[0]?.id ?? '');
    expect(await status(created.id)).toBe('cancelled');
  });

  it('refuses Airtel Money before creating anything, while it is not integrated', async () => {
    const before = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM orders');
    const res = await order(lines.mtnPayout, 503, 'airtel_money', '0701234567');
    expect(errorOf(res)).toMatchObject({ code: 'provider_unavailable', details: { path: 'payment_method' } });
    expect((await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM orders')).rows[0]?.n).toBe(before.rows[0]?.n);
  });

  it('flags payouts to Airtel numbers for an admin to settle by hand', async () => {
    const created = data<OrderDto>(await order(lines.airtelPayout, 201));
    const ref = (await pool.query<{ provider_ref: string }>(`SELECT provider_ref FROM payments WHERE order_id = $1`, [created.id])).rows[0]?.provider_ref ?? '';
    const entry = mtnApi.collections.get(ref);
    if (entry) entry.status = 'SUCCESSFUL';
    await request(app).post('/api/v1/webhooks/payments/mtn_momo').send({ externalId: ref }).expect(200);
    await request(app).post('/api/v1/webhooks/sms/inbound').type('form').send({ from: lines.airtelPayout.contact_phone, text: `${created.short_code} 1` }).expect(200);
    await request(app).put(`/api/v1/orders/${created.id}/confirm-delivery`).set(buyer).expect(200);
    await runJobs(['payout-check']);
    expect(await status(created.id)).toBe('delivered');
    const { rows } = await pool.query<{ action: string }>(`SELECT action FROM audit_log WHERE entity_id = $1 AND action = 'payout.flagged'`, [created.id]);
    expect(rows).toHaveLength(1);
  });
});
