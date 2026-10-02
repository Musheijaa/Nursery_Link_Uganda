import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue } from '../../jobs/queue.js';
import { adminToken, bearer, newBuyer } from '../../../test/auth.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const providers = mockProviders();
const app = createApp({ config: testConfig(inject('databaseUrl')), pool, logger: pino({ level: 'silent' }), providers, queue: new RecordingQueue() });

type Kpi = { value: number; previous: number };
type Analytics = {
  range: string;
  bucket: string;
  kpis: Record<'sales_ugx' | 'orders' | 'seedlings_sold' | 'avg_order_ugx' | 'new_buyers' | 'free_seedlings', Kpi>;
  series: { date: string; sales_ugx: number; orders: number }[];
  order_status: { status: string; count: number }[];
  top_species: { species_id: string; seedlings: number }[];
  top_nurseries: { nursery_id: string; sales_ugx: number }[];
  stock_by_category: { category: string; seedlings: number }[];
};

let admin: Record<string, string>;
const get = async (range = '30d') => {
  const res = await request(app).get(`/api/v1/admin/analytics?range=${range}`).set(admin);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return (res.body as { data: Analytics }).data;
};

/** Places an order through the API, then marks it paid (as the payment callback would). */
const paidOrder = async (quantity: number) => {
  const buyer = bearer((await newBuyer(app, providers.sms)).token);
  const { rows: [line] } = await pool.query<{ inventory_id: string; nursery_id: string; species_id: string }>(
    `SELECT i.id AS inventory_id, i.nursery_id, i.species_id FROM inventory i JOIN nurseries n ON n.id = i.nursery_id
     WHERE n.is_active AND i.quantity_available > 50 ORDER BY i.id DESC LIMIT 1`);
  const quote = await request(app).post('/api/v1/orders/quote').set(buyer)
    .send({ nursery_id: line?.nursery_id, items: [{ inventory_id: line?.inventory_id, quantity }], delivery_type: 'self_pickup' }).expect(200);
  const placed = await request(app).post('/api/v1/orders').set(buyer)
    .send({ quote_token: (quote.body as { data: { quote_token: string } }).data.quote_token, payment_method: 'mtn_momo', payer_phone: '0772123456' }).expect(201);
  const order = (placed.body as { data: { id: string; grand_total: number } }).data;
  await pool.query(`UPDATE orders SET status = 'escrow_held', paid_at = now() WHERE id = $1`, [order.id]);
  return { ...order, species_id: line?.species_id ?? '', nursery_id: line?.nursery_id ?? '' };
};

beforeAll(async () => {
  await prepareTestDatabase(pool);
  admin = bearer(await adminToken(app));
});
afterAll(async () => { await pool.end(); });

describe('GET /admin/analytics', () => {
  it('buckets by day, week or month, and the chart adds up to the headline figures', async () => {
    const days = await get('30d');
    expect(days.bucket).toBe('day');
    expect(days.series).toHaveLength(31); // 30 days back, plus today
    const weeks = await get('90d');
    expect(weeks.bucket).toBe('week');
    expect(weeks.series.length).toBeGreaterThanOrEqual(13);
    expect(weeks.series.length).toBeLessThanOrEqual(15);
    const months = await get('12m');
    expect(months.bucket).toBe('month');
    expect(months.series).toHaveLength(13);
    for (const a of [days, weeks, months]) {
      expect(a.series.reduce((sum, b) => sum + b.sales_ugx, 0)).toBe(a.kpis.sales_ugx.value);
      expect(a.series.reduce((sum, b) => sum + b.orders, 0)).toBe(a.kpis.orders.value);
    }
    // Stock by category is today's stock at active nurseries
    expect(days.stock_by_category.length).toBeGreaterThan(0);
  });

  it('counts a paid order in sales, seedlings and the top lists, and stops counting it once refunded', async () => {
    const before = await get();
    const order = await paidOrder(7);
    const after = await get();
    // Other test files place orders at the same time: check "at least", and find ours
    expect(after.kpis.orders.value).toBeGreaterThanOrEqual(before.kpis.orders.value + 1);
    expect(after.kpis.sales_ugx.value).toBeGreaterThanOrEqual(before.kpis.sales_ugx.value + order.grand_total);
    expect(after.kpis.seedlings_sold.value).toBeGreaterThanOrEqual(before.kpis.seedlings_sold.value + 7);
    expect(after.top_species.map(s => s.species_id)).toContain(order.species_id);
    expect(after.series.at(-1)?.orders).toBeGreaterThanOrEqual(1);

    // Refunded money is not sales: the total drops by this order (plus anything other tests paid meanwhile)
    const { rows: [mark] } = await pool.query<{ t: Date }>('SELECT now() AS t');
    await pool.query(`UPDATE orders SET status = 'refunded' WHERE id = $1`, [order.id]);
    const refunded = await get();
    const { rows: [others] } = await pool.query<{ n: number }>(
      `SELECT COALESCE(sum(grand_total), 0)::int AS n FROM orders WHERE paid_at >= $1 AND id <> $2 AND status <> 'refunded'`, [mark?.t, order.id]);
    expect(refunded.kpis.sales_ugx.value).toBeLessThanOrEqual(after.kpis.sales_ugx.value - order.grand_total + (others?.n ?? 0));
    expect(refunded.order_status.find(s => s.status === 'refunded')?.count).toBeGreaterThanOrEqual(1);
  });

  it('accepts only the three periods, and only for admins', async () => {
    await request(app).get('/api/v1/admin/analytics?range=7y').set(admin).expect(400);
    await request(app).get('/api/v1/admin/analytics').expect(401);
  });
});
