import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue } from '../../jobs/queue.js';
import { adminToken, bearer, newBuyer } from '../../../test/auth.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { errorOf } from '../../../test/http.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const mediaDir = mkdtempSync(join(tmpdir(), 'nl-media-'));
const pool = createPool(inject('databaseUrl'));
const providers = mockProviders();
const app = createApp({ config: testConfig(inject('databaseUrl'), { MEDIA_DIR: mediaDir }), pool, logger: pino({ level: 'silent' }), providers, queue: new RecordingQueue() });

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a response body in tests
const data = <T>(res: request.Response) => (res.body as { data: T }).data;

let admin: Record<string, string>;
beforeAll(async () => {
  await prepareTestDatabase(pool);
  admin = bearer(await adminToken(app));
});
afterAll(async () => {
  rmSync(mediaDir, { recursive: true, force: true });
  await pool.end();
});

describe('GET /admin/dashboard', () => {
  it('lists what needs attention, with counts', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set(admin);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const d = data<Record<string, { count: number; items: unknown[] }> & { thresholds: Record<string, number> }>(res);
    for (const key of ['disputed_orders', 'stuck_escrow', 'failed_payouts', 'stale_stock', 'pending_applications', 'unparsed_sms']) {
      expect(d[key]?.count).toBeGreaterThanOrEqual(0);
      expect((d[key]?.items.length ?? 0) <= 5).toBe(true);
    }
    expect(d.thresholds).toEqual({ stuck_escrow_hours: 24, stale_stock_days: 30, sms_window_days: 7 });
  });

  it('counts a new pending application and an unrecognised SMS reply', async () => {
    const before = data<{ pending_applications: { count: number }; unparsed_sms: { count: number } }>(await request(app).get('/api/v1/admin/dashboard').set(admin));
    const buyer = bearer((await newBuyer(app, providers.sms)).token);
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM campaigns WHERE title LIKE 'Coffee shade%'`);
    await request(app).post(`/api/v1/campaigns/${rows[0]?.id ?? ''}/apply`).set(buyer)
      .send({ answers: { coffee_farmer: true, coffee_trees: 200 }, quantity_requested: 10 }).expect(201);
    const text = `Hello? ${String(Date.now())}`;
    await request(app).post('/api/v1/webhooks/sms/inbound').type('form').send({ from: '+256772000111', text }).expect(200);
    const after = data<{ pending_applications: { count: number; items: { applicant_name: string }[] }; unparsed_sms: { count: number; items: { text: string }[] } }>(
      await request(app).get('/api/v1/admin/dashboard').set(admin)
    );
    // Other test files add applications and SMS concurrently, so check "at least one more" and find ours
    expect(after.pending_applications.count).toBeGreaterThan(before.pending_applications.count);
    expect(after.unparsed_sms.count).toBeGreaterThan(before.unparsed_sms.count);
    expect(after.unparsed_sms.items.map(i => i.text)).toContain(text);
  });

  it('lists a failed payout in the API shape', async () => {
    const buyer = bearer((await newBuyer(app, providers.sms)).token);
    const { rows: [line] } = await pool.query<{ inventory_id: string; nursery_id: string }>(
      `SELECT i.id AS inventory_id, i.nursery_id FROM inventory i JOIN nurseries n ON n.id = i.nursery_id WHERE n.is_active AND i.quantity_available > 5 ORDER BY i.id LIMIT 1`);
    const quote = await request(app).post('/api/v1/orders/quote').set(buyer)
      .send({ nursery_id: line?.nursery_id, items: [{ inventory_id: line?.inventory_id, quantity: 1 }], delivery_type: 'self_pickup' }).expect(200);
    const order = data<{ id: string; short_code: string; grand_total: number }>(await request(app).post('/api/v1/orders').set(buyer)
      .send({ quote_token: data<{ quote_token: string }>(quote).quote_token, payment_method: 'mtn_momo', payer_phone: '0772123456' }).expect(201));
    await pool.query(
      `INSERT INTO payments (order_id, kind, provider, idempotency_key, msisdn, amount, status) VALUES ($1, 'disbursement', 'mock', gen_random_uuid(), '+256772100114', $2, 'failed')`,
      [order.id, order.grand_total]);

    const res = await request(app).get('/api/v1/admin/dashboard').set(admin);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const failed = data<{ failed_payouts: { count: number; items: { order_id: string }[] } }>(res).failed_payouts;
    expect(failed.count).toBeGreaterThanOrEqual(1);
    expect(failed.items.map(i => i.order_id)).toContain(order.id);
  });

  it('is admin-only', async () => {
    const buyer = bearer((await newBuyer(app, providers.sms)).token);
    await request(app).get('/api/v1/admin/dashboard').expect(401);
    await request(app).get('/api/v1/admin/dashboard').set(buyer).expect(403);
  });
});

describe('POST /admin/media', () => {
  it('stores a photo as 480 and 960 px WebP without EXIF, served for a year and embeddable', async () => {
    const photo = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#1b5e3a' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret GPS here' } } })
      .toBuffer();
    const res = await request(app).post('/api/v1/admin/media').set(admin).attach('file', photo, { filename: 'mvule.jpg', contentType: 'image/jpeg' }).expect(201);
    const m = data<{ url: string; srcset: { url: string; width: number }[]; width: number; height: number }>(res);
    expect(m.url).toMatch(/^\/media\/[0-9a-f-]{36}-960\.webp$/);
    expect(m.srcset.map(s => s.width)).toEqual([480, 960]);
    expect([m.width, m.height]).toEqual([960, 720]);
    expect(readdirSync(mediaDir)).toHaveLength(2);

    const served = await request(app).get(m.url).expect(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['cache-control']).toContain('immutable');
    expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');
    const stored = await sharp(served.body as Buffer).metadata();
    expect(stored.exif).toBeUndefined();

    const { rows } = await pool.query<{ action: string }>(`SELECT action FROM audit_log WHERE action = 'media.upload' ORDER BY id DESC LIMIT 1`);
    expect(rows[0]?.action).toBe('media.upload');
  });

  it('refuses files that are not photos, and photos over 5 MB', async () => {
    const notImage = await request(app).post('/api/v1/admin/media').set(admin).attach('file', Buffer.from('hello'), { filename: 'x.jpg', contentType: 'image/jpeg' }).expect(400);
    expect(errorOf(notImage).message).toBe('That file is not a readable image');
    await request(app).post('/api/v1/admin/media').set(admin).attach('file', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' }).expect(400);
    await request(app).post('/api/v1/admin/media').set(admin).attach('file', Buffer.alloc(6 * 1024 * 1024), { filename: 'big.jpg', contentType: 'image/jpeg' }).expect(413);
    await request(app).post('/api/v1/admin/media').set(admin).expect(400);
  });

  it('404s for missing media without falling through to the API', async () => {
    await request(app).get('/media/does-not-exist.webp').expect(404);
  });
});

describe('GET /admin/orders/:id', () => {
  it('404s for an unknown order', async () => {
    await request(app).get('/api/v1/admin/orders/00000000-0000-4000-8000-000000000000').set(admin).expect(404);
  });
});
