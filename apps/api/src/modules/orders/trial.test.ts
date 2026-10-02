import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import type { AuthTokens, OrderStatus } from '@nurserylink/shared';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue, type JobName } from '../../jobs/queue.js';
import { jobHandlers } from '../../jobs/worker.js';
import { buildServices } from '../../services.js';
import { adminToken, bearer } from '../../../test/auth.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';
import type { OrderDto, QuoteResult } from './orders.service.js';

/** Trial mode: PHONE_VERIFICATION=off and PAYMENTS=off, for trying the whole system before SMS and payments are live. */
const pool = createPool(inject('databaseUrl'));
const providers = mockProviders();
const queue = new RecordingQueue();
const logger = pino({ level: 'silent' });
const config = testConfig(inject('databaseUrl'), { PHONE_VERIFICATION: 'off', PAYMENTS: 'off' });
const deps = { config, pool, logger, providers, queue };
const services = buildServices(deps);
const app = createApp(deps, services);
const handlers = jobHandlers(services, logger);

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a response body in tests
const data = <T>(res: request.Response) => (res.body as { data: T }).data;
const orderStatus = async (id: string) => (await pool.query<{ status: OrderStatus }>('SELECT status FROM orders WHERE id = $1', [id])).rows[0]?.status;

const drainJobs = async (only?: JobName[]) => {
  for (let round = 0; round < 20; round++) {
    const next = queue.jobs.find(j => !only || only.includes(j.name));
    if (!next) return;
    queue.jobs.splice(queue.jobs.indexOf(next), 1);
    await (handlers[next.name] as (d: unknown) => Promise<void>)(next.data);
  }
};

let counter = 0;
const uniquePhone = () => `0752${String((Date.now() % 100000) * 10 + (++counter % 10)).padStart(6, '0').slice(-6)}`;

let line: { inventory_id: string; nursery_id: string; quantity: number; contact_phone: string };

beforeAll(async () => {
  await prepareTestDatabase(pool);
  const { rows } = await pool.query<typeof line>(`
    SELECT i.id AS inventory_id, i.nursery_id, i.quantity_available AS quantity, n.contact_phone
    FROM inventory i JOIN nurseries n ON n.id = i.nursery_id WHERE n.is_active ORDER BY n.name DESC, i.id LIMIT 1`);
  if (!rows[0]) throw new Error('No seeded inventory');
  line = rows[0];
});
afterAll(async () => {
  await pool.query('UPDATE inventory SET quantity_available = $1 WHERE id = $2', [line.quantity, line.inventory_id]);
  await pool.end();
});
beforeEach(async () => {
  queue.jobs.length = 0;
  await pool.query('UPDATE inventory SET quantity_available = 100 WHERE id = $1', [line.inventory_id]);
});

describe('trial mode: no SMS code at sign-up', () => {
  it('confirms the account on registration and signs in straight away, without texting a code', async () => {
    const phone = uniquePhone();
    const e164 = `+256${phone.slice(1)}`;
    const res = await request(app).post('/api/v1/auth/register').send({ full_name: 'Trial Buyer', phone, password: 'trial-password-1' }).expect(201);
    const body = data<{ user: { phone_verified: boolean }; verification: unknown; tokens: AuthTokens | null }>(res);
    expect(body.verification).toBeNull();
    expect(body.user.phone_verified).toBe(true);
    expect(body.tokens?.access_token).toBeTruthy();
    expect(String(res.headers['set-cookie'])).toMatch(/nl_refresh=/);
    expect(providers.sms.lastTo(e164)).toBeUndefined();

    // And the account signs in with its password, no code needed
    await request(app).post('/api/v1/auth/login').send({ identifier: phone, password: 'trial-password-1' }).expect(200);
  });

  it('reports the switches in /health so the apps can hide the code and payment steps', async () => {
    const health = data<{ features: { phone_verification: boolean; payments: boolean } }>(await request(app).get('/api/v1/health').expect(200));
    expect(health.features).toEqual({ phone_verification: false, payments: false });
  });
});

describe('trial mode: no payment step', () => {
  it('confirms an order at once as a trial order, then runs dispatch, delivery and payout to completion', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ full_name: 'Trial Orderer', phone: uniquePhone(), password: 'trial-password-1' }).expect(201);
    const buyer = bearer(data<{ tokens: AuthTokens }>(reg).tokens.access_token);
    const quote = data<QuoteResult>(await request(app).post('/api/v1/orders/quote').set(buyer)
      .send({ nursery_id: line.nursery_id, items: [{ inventory_id: line.inventory_id, quantity: 4 }], delivery_type: 'self_pickup' }).expect(200));

    // No payment method or paying number
    const placed = await request(app).post('/api/v1/orders').set(buyer).send({ quote_token: quote.quote_token }).expect(201);
    const order = data<OrderDto>(placed);
    expect(order).toMatchObject({ status: 'escrow_held', payment_method: 'trial' });
    expect(order.paid_at).toBeTruthy();
    // The history says what happened: confirmed, not paid
    const { rows: [history] } = await pool.query<{ reason: string }>(
      `SELECT after->>'reason' AS reason FROM audit_log WHERE entity_id = $1 AND action = 'order.status_changed' ORDER BY id LIMIT 1`, [order.id]);
    expect(history?.reason).toBe('Confirmed (trial, no payment)');
    expect((placed.body as { meta: { next_step: string } }).meta.next_step).toMatch(/confirmed/);
    // Stock was taken, and the nursery got its order SMS (texts go out through the job queue)
    await drainJobs(['sms-send']);
    expect((await pool.query<{ q: number }>('SELECT quantity_available AS q FROM inventory WHERE id = $1', [line.inventory_id])).rows[0]?.q).toBe(96);
    expect(providers.sms.lastTo(line.contact_phone)?.message).toContain(order.short_code);

    // The admin dispatches, the buyer confirms, the (mock) payout completes it
    const admin = bearer(await adminToken(app));
    await request(app).put(`/api/v1/admin/orders/${order.id}/status`).set(admin).send({ status: 'dispatched', reason: 'Trial: nursery called' }).expect(200);
    await request(app).put(`/api/v1/orders/${order.id}/confirm-delivery`).set(buyer).expect(200);
    await drainJobs(['payout-check']);
    expect(await orderStatus(order.id)).toBe('released');
  });

  it('shows a new order to admins straight away: on Needs attention, and findable by nursery, buyer and code', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ full_name: 'Admin Sees Me', phone: uniquePhone(), password: 'trial-password-1' }).expect(201);
    const { user, tokens } = data<{ user: { id: string; phone: string }; tokens: AuthTokens }>(reg);
    const quote = data<QuoteResult>(await request(app).post('/api/v1/orders/quote').set(bearer(tokens.access_token))
      .send({ nursery_id: line.nursery_id, items: [{ inventory_id: line.inventory_id, quantity: 2 }], delivery_type: 'self_pickup' }).expect(200));
    const order = data<OrderDto>(await request(app).post('/api/v1/orders').set(bearer(tokens.access_token)).send({ quote_token: quote.quote_token }).expect(201));
    const admin = bearer(await adminToken(app));

    const dash = data<{ orders_to_dispatch: { count: number; items: { id: string }[] } }>(await request(app).get('/api/v1/admin/dashboard').set(admin).expect(200));
    expect(dash.orders_to_dispatch.count).toBeGreaterThanOrEqual(1);
    expect(dash.orders_to_dispatch.items.map(o => o.id)).toContain(order.id);

    const ids = async (query: string) => data<{ id: string }[]>(await request(app).get(`/api/v1/admin/orders?${query}`).set(admin).expect(200)).map(o => o.id);
    expect(await ids(`nursery_id=${line.nursery_id}`)).toContain(order.id);
    expect(await ids(`buyer_id=${user.id}`)).toEqual([order.id]);
    expect(await ids(`q=${order.short_code.toLowerCase()}`)).toEqual([order.id]);
    expect(await ids('q=Admin%20Sees')).toEqual([order.id]);
    // A phone number as people type it ("0752…") finds the stored +256 number
    expect(await ids(`q=0${user.phone.slice(4)}`)).toEqual([order.id]);
    expect(await ids('nursery_id=00000000-0000-4000-8000-000000000000')).toEqual([]);
  });

  it('refuses switching payments off while live payments are configured', () => {
    expect(() => testConfig(inject('databaseUrl'), { PAYMENTS: 'off', PAYMENT_PROVIDER_MODE: 'live' })).toThrow(/PAYMENTS=off needs PAYMENT_PROVIDER_MODE=mock/);
  });
});
