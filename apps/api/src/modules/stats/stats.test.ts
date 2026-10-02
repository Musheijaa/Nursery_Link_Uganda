import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue } from '../../jobs/queue.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const app = createApp({ config: testConfig(inject('databaseUrl')), pool, logger: pino({ level: 'silent' }), providers: mockProviders(), queue: new RecordingQueue() });

beforeAll(async () => { await prepareTestDatabase(pool); });
afterAll(async () => { await pool.end(); });

describe('GET /stats', () => {
  it('counts what visitors can find, for anyone, matching the database', async () => {
    const res = await request(app).get('/api/v1/stats').expect(200);
    const s = (res.body as { data: Record<string, number> }).data;
    // Other test files change stock in parallel, so only the nursery count is compared exactly
    const { rows: [db] } = await pool.query<{ nurseries: number }>('SELECT count(*)::int AS nurseries FROM nurseries WHERE is_active');
    expect(s.nurseries).toBe(db?.nurseries);
    expect(s.seedlings_in_stock).toBeGreaterThan(0);
    expect(s.species_in_stock).toBeGreaterThan(0);
    expect(s.sub_counties).toBeGreaterThan(0);
    expect(s.open_campaigns).toBeGreaterThanOrEqual(0);
  });
});
