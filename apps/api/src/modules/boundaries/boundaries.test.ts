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

beforeAll(() => prepareTestDatabase(pool));
afterAll(() => pool.end());

type Boundary = { id: string; name: string; level: string; parent_id: string | null };

describe('boundaries (FR-07)', () => {
  it('feeds the cascading District → Sub-county dropdowns', async () => {
    const districts = (await request(app).get('/api/v1/boundaries?level=district').expect(200)).body as { data: Boundary[] };
    expect(districts.data).toEqual([expect.objectContaining({ name: 'Mukono', level: 'district', parent_id: null })]);

    const districtId = districts.data[0]?.id ?? '';
    const subs = (await request(app).get(`/api/v1/boundaries?level=sub_county&parent_id=${districtId}`).expect(200)).body as { data: Boundary[] };
    expect(subs.data).toHaveLength(15);
    expect(subs.data.every(s => s.parent_id === districtId)).toBe(true);
    const names = subs.data.map(s => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  });

  it('returns one boundary as a GeoJSON feature', async () => {
    const { data } = (await request(app).get('/api/v1/boundaries?level=district').expect(200)).body as { data: Boundary[] };
    const res = await request(app).get(`/api/v1/boundaries/${data[0]?.id ?? ''}/geojson`).expect(200);
    expect(res.body).toMatchObject({ data: { type: 'Feature', geometry: { type: 'MultiPolygon' }, properties: { name: 'Mukono', level: 'district' } } });
    await request(app).get('/api/v1/boundaries/00000000-0000-4000-8000-000000000000/geojson').expect(404);
    await request(app).get('/api/v1/boundaries?level=county').expect(400);
  });
});
