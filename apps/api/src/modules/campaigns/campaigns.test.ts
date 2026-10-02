import { RecordingQueue } from '../../jobs/queue.js';
import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const app = createApp({ config: testConfig(inject('databaseUrl')), pool, logger: pino({ level: 'silent' }), providers: mockProviders(), queue: new RecordingQueue() });

type Campaign = {
  id: string; title: string; is_open: boolean; remaining_stock: number; allocated_stock: number; remaining_pct: number;
  sub_county: { name: string }; pickup_nursery: { name: string; location: { lat: number; lng: number } };
  eligibility_rules: { key: string }[]; species: { slug: string; quantity: number }[];
};

let endedId = '';
beforeAll(async () => {
  await prepareTestDatabase(pool);
  const { rows } = await pool.query<{ id: string }>(`
    INSERT INTO campaigns (nursery_id, title, funder_name, funder_type, purpose, sub_county_id, allocated_stock, remaining_stock, starts_at, ends_at)
    SELECT n.id, 'Last season''s campaign', 'Old Funder', 'government', 'Woodlots', n.sub_county_id, 100, 0, now() - interval '200 days', now() - interval '100 days'
    FROM nurseries n WHERE n.name = 'Kasawo Farmers'' Nursery' RETURNING id`);
  endedId = rows[0]?.id ?? '';
});
afterAll(() => pool.end());

describe('campaigns (FR-16)', () => {
  it('lists running campaigns with the stock meter, pickup point and checklist', async () => {
    const body = (await request(app).get('/api/v1/campaigns').expect(200)).body as { data: Campaign[]; meta: { total: number } };
    expect(body.meta.total).toBe(2);
    const shoreline = body.data.find(c => c.title === 'Lake Victoria shoreline restoration');
    expect(shoreline).toMatchObject({
      is_open: true, allocated_stock: 20000, remaining_stock: 13400, remaining_pct: 67,
      sub_county: { name: 'Ntenjeru' },
      pickup_nursery: { name: 'Katosi Lakeshore Seedlings', location: { lat: 0.205, lng: 32.8 } },
    });
    expect(shoreline?.eligibility_rules.map(r => r.key)).toEqual(['lc1_letter', 'land_acres', 'near_shoreline']);
    expect(shoreline?.species.reduce((s, i) => s + i.quantity, 0)).toBe(20000);
  });

  it('filters by sub-county and purpose, and leaves out ended campaigns', async () => {
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM admin_boundaries WHERE name = 'Nakisunga'`);
    const bySubCounty = (await request(app).get(`/api/v1/campaigns?sub_county_id=${rows[0]?.id ?? ''}`).expect(200)).body as { data: Campaign[] };
    expect(bySubCounty.data.map(c => c.title)).toEqual(['Coffee shade trees for Nakisunga farmers']);
    const byPurpose = (await request(app).get('/api/v1/campaigns?purpose=shoreline').expect(200)).body as { data: Campaign[] };
    expect(byPurpose.data.map(c => c.title)).toEqual(['Lake Victoria shoreline restoration']);
    const all = (await request(app).get('/api/v1/campaigns?limit=100').expect(200)).body as { data: Campaign[] };
    expect(all.data.map(c => c.id)).not.toContain(endedId);
  });

  it('shows any campaign by id, flagging whether it is still open', async () => {
    const ended = (await request(app).get(`/api/v1/campaigns/${endedId}`).expect(200)).body as { data: Campaign };
    expect(ended.data).toMatchObject({ is_open: false, remaining_pct: 0 });
    await request(app).get('/api/v1/campaigns/00000000-0000-4000-8000-000000000000').expect(404);
  });
});
