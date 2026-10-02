import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue } from '../../jobs/queue.js';
import { buildServices } from '../../services.js';
import { adminToken, bearer, newBuyer } from '../../../test/auth.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { errorOf } from '../../../test/http.js';
import { DownRouting, mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';
import type { LayerCollection } from './shadow.repo.js';
import type { RunDto } from './shadow.service.js';

const pool = createPool(inject('databaseUrl'));
const providers = mockProviders();
const queue = new RecordingQueue();
const logger = pino({ level: 'silent' });
const deps = { config: testConfig(inject('databaseUrl')), pool, logger, providers, queue };
const services = buildServices(deps);
const app = createApp(deps, services);
// Same database, but the routing service is down
const downServices = buildServices({ ...deps, providers: { ...providers, routing: new DownRouting() } });

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a response body in tests
const data = <T>(res: request.Response) => (res.body as { data: T }).data;
const meta = (res: request.Response) => (res.body as { meta: { outcome: string; warnings?: string[] } }).meta;

let admin: Record<string, string>;

/**
 * Forest-loss cells on an exact grid of 0.009° (about 1 km). Neighbouring cells share edges
 * exactly, as cells from the loader script do, so they dissolve into one zone.
 */
const addCells = async (cells: { row: number; col: number; pct: number; year?: number }[], origin = { lat: 0.03, lng: 32.93 }) => {
  for (const c of cells) {
    await pool.query(
      `INSERT INTO forest_loss_cells (geom, loss_pct, loss_year_from, loss_year_to)
       VALUES (ST_MakeEnvelope($1 + $3 * 0.009, $2 + $4 * 0.009, $1 + ($3 + 1) * 0.009, $2 + ($4 + 1) * 0.009, 4326), $5, $6, $6)`,
      [origin.lng, origin.lat, c.col, c.row, c.pct, c.year ?? 2020]
    );
  }
};

const startRun = (body: object = { threshold_pct: 20, since_year: 2015 }) => request(app).post('/api/v1/admin/shadow/runs').set(admin).send(body);

/** Runs the queued shadow-run jobs, as the pg-boss worker would. */
const runJobs = async (svc = services) => {
  for (const { runId } of queue.take('shadow-run')) {
    await svc.shadow.execute(runId).catch((err: unknown) => {
      if (svc === services) throw err;
    });
  }
};

beforeAll(async () => {
  await prepareTestDatabase(pool);
  admin = bearer(await adminToken(app));
});

afterAll(async () => {
  await pool.query('DELETE FROM shadow_runs');
  await pool.query('DELETE FROM forest_loss_cells');
  await pool.end();
});

beforeEach(async () => {
  queue.jobs.length = 0;
  await pool.query('DELETE FROM shadow_runs');
  await pool.query('DELETE FROM forest_loss_cells');
});

describe('Nursery Shadow runs', () => {
  it('finds forest loss beyond every nursery’s 20 km service area', async () => {
    // Far south-east, over 20 km by road from every nursery: a 3 × 2 block, one corner cell below the threshold
    await addCells([
      { row: 0, col: 0, pct: 30 }, { row: 0, col: 1, pct: 30 }, { row: 0, col: 2, pct: 30 },
      { row: 1, col: 0, pct: 30 }, { row: 1, col: 1, pct: 30 }, { row: 1, col: 2, pct: 5 },
    ]);
    // Heavy loss right next to Mukono Town Nursery: served, so not a shadow
    await addCells([{ row: 0, col: 0, pct: 80 }], { lat: 0.36, lng: 32.76 });
    // Old loss (2010) far away: counts only for runs looking back that far
    await addCells([{ row: 5, col: 5, pct: 40, year: 2010 }]);

    const res = await startRun().expect(202);
    const run = data<RunDto>(res);
    expect(run).toMatchObject({ status: 'queued', params: { threshold_pct: 20, since_year: 2015 } });
    expect(meta(res).outcome).toBe('new');

    // Not ready yet
    await request(app).get(`/api/v1/admin/shadow/runs/${run.id}/geojson`).set(admin).expect(409);

    await runJobs();
    const done = data<RunDto>(await request(app).get(`/api/v1/admin/shadow/runs/${run.id}`).set(admin).expect(200));
    expect(done.status).toBe('succeeded');
    expect(done.summary.nurseries).toBe(15);
    expect(done.summary.shadow_zones).toBe(1);
    expect(done.summary.shadow_area_km2).toBeGreaterThan(4.5);
    expect(done.summary.shadow_area_km2).toBeLessThan(5.5);

    const shadows = data<LayerCollection>(await request(app).get(`/api/v1/admin/shadow/runs/${run.id}/geojson?layer=shadows`).set(admin).expect(200));
    expect(shadows.features).toHaveLength(1);
    expect(shadows.features[0]?.geometry.type).toBe('MultiPolygon');
    expect(shadows.features[0]?.properties).toMatchObject({ loss_pct: 30 });

    // The cells behind it: from half the threshold up, worst first, marked when inside a shadow.
    // The 5% corner is below half the threshold and the 2010 cell is before since_year, so both are left out.
    const cells = data<LayerCollection>(await request(app).get(`/api/v1/admin/shadow/runs/${run.id}/geojson?layer=cells`).set(admin).expect(200));
    expect(cells.features.map(f => f.properties)).toEqual([
      { loss_pct: 80, in_shadow: false },
      ...Array.from({ length: 5 }, () => ({ loss_pct: 30, in_shadow: true })),
    ]);
    expect(cells.features[0]?.geometry.type).toBe('MultiPolygon');

    const zones = data<LayerCollection>(await request(app).get(`/api/v1/admin/shadow/runs/${run.id}/geojson?layer=zones`).set(admin).expect(200));
    expect(zones.features).toHaveLength(45);
    expect(zones.features.map(f => ('km' in f.properties ? f.properties.km : 0))[0]).toBe(20);

    // The 20 km area around Mukono Town contains the town and not the far-away shadow
    const { rows } = await pool.query<{ town: boolean; far: boolean; nested: boolean }>(`
      SELECT ST_Contains(z20.geom, n.location) AS town,
             ST_Intersects(z20.geom, ST_SetSRID(ST_MakePoint(32.94, 0.035), 4326)) AS far,
             ST_Area(z5.geom) < ST_Area(z10.geom) AND ST_Area(z10.geom) < ST_Area(z20.geom) AS nested
      FROM nurseries n
      JOIN service_zones z5 ON z5.nursery_id = n.id AND z5.km = 5 AND z5.run_id = $1
      JOIN service_zones z10 ON z10.nursery_id = n.id AND z10.km = 10 AND z10.run_id = $1
      JOIN service_zones z20 ON z20.nursery_id = n.id AND z20.km = 20 AND z20.run_id = $1
      WHERE n.name = 'Mukono Town Nursery'`, [run.id]);
    expect(rows[0]).toEqual({ town: true, far: false, nested: true });

    const exported = await request(app).get(`/api/v1/admin/export/shadow/${run.id}.geojson`).set(admin).expect(200);
    expect(exported.headers['content-type']).toContain('application/geo+json');
    expect(exported.headers['content-disposition']).toMatch(/attachment; filename="nursery-shadow-[0-9a-f]{8}\.geojson"/);
    expect((JSON.parse(exported.text) as LayerCollection).features).toHaveLength(1);
  });

  it('applies since_year: older loss counts only for runs that look back far enough', async () => {
    await addCells([{ row: 0, col: 0, pct: 25, year: 2010 }, { row: 0, col: 1, pct: 10, year: 2016 }, { row: 0, col: 1, pct: 15, year: 2018 }]);
    const recent = data<RunDto>(await startRun({ threshold_pct: 20, since_year: 2015 }).expect(202));
    const longer = data<RunDto>(await startRun({ threshold_pct: 20, since_year: 2005 }).expect(202));
    await runJobs();
    const shadows = async (id: string) => data<LayerCollection>(await request(app).get(`/api/v1/admin/shadow/runs/${id}/geojson`).set(admin).expect(200));
    // Since 2015 only the second cell qualifies (10 + 15 = 25%); since 2005 both do and they merge
    expect((await shadows(recent.id)).features.map(f => ('loss_pct' in f.properties ? f.properties.loss_pct : 0))).toEqual([25]);
    const merged = await shadows(longer.id);
    expect(merged.features).toHaveLength(1);
    expect('area_km2' in (merged.features[0]?.properties ?? {}) && merged.features[0]?.properties).toMatchObject({ loss_pct: 25 });
  });

  it('reuses the last run until nurseries or forest-loss data change', async () => {
    await addCells([{ row: 0, col: 0, pct: 50 }]);
    const first = data<RunDto>(await startRun().expect(202));

    // While it is queued, an identical request joins it
    const joined = await startRun().expect(200);
    expect(meta(joined).outcome).toBe('in_progress');
    expect(data<RunDto>(joined).id).toBe(first.id);
    await runJobs();

    const cached = await startRun().expect(200);
    expect(meta(cached).outcome).toBe('cached');
    expect(data<RunDto>(cached).id).toBe(first.id);

    // Different parameters are a different run
    await startRun({ threshold_pct: 40, since_year: 2015 }).expect(202);
    await runJobs();

    // New loss data invalidates the cache
    await addCells([{ row: 3, col: 3, pct: 50 }]);
    const afterData = await startRun().expect(202);
    expect(data<RunDto>(afterData).id).not.toBe(first.id);
    await runJobs();

    // So does a nursery being switched off
    await pool.query(`UPDATE nurseries SET is_active = false WHERE name = 'Ntunda Hills Nursery'`);
    try {
      await startRun().expect(202);
    } finally {
      await pool.query(`UPDATE nurseries SET is_active = true WHERE name = 'Ntunda Hills Nursery'`);
    }

    const list = await request(app).get('/api/v1/admin/shadow/runs').set(admin).expect(200);
    expect((list.body as { meta: { total: number } }).meta.total).toBe(4);
    const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'shadow.run_requested' AND entity_id = $1`, [first.id]);
    expect(rows[0]?.n).toBe(1);
  });

  it('warns when no forest-loss data is loaded', async () => {
    const res = await startRun().expect(202);
    expect(meta(res).warnings?.[0]).toMatch(/No forest-loss data/);
    await runJobs();
    expect(data<RunDto>(await request(app).get(`/api/v1/admin/shadow/runs/${data<RunDto>(res).id}`).set(admin)).summary.shadow_zones).toBe(0);
  });

  it('records a failed run, with the reason, when routing is down', async () => {
    await addCells([{ row: 0, col: 0, pct: 50 }]);
    const run = data<RunDto>(await startRun().expect(202));
    await runJobs(downServices);
    const failed = data<RunDto>(await request(app).get(`/api/v1/admin/shadow/runs/${run.id}`).set(admin).expect(200));
    expect(failed).toMatchObject({ status: 'failed', error: 'Routing service unreachable', summary: { nurseries: 0, shadow_zones: 0 } });
    expect(errorOf(await request(app).get(`/api/v1/admin/shadow/runs/${run.id}/geojson`).set(admin).expect(409)).details).toEqual({ status: 'failed' });
    // A failed run is never reused
    expect(meta(await startRun().expect(202)).outcome).toBe('new');
  });

  it('validates parameters and ids', async () => {
    await startRun({ threshold_pct: 0, since_year: 2015 }).expect(400);
    await startRun({ threshold_pct: 20, since_year: 1999 }).expect(400);
    await request(app).get('/api/v1/admin/shadow/runs/00000000-0000-4000-8000-000000000000').set(admin).expect(404);
    await request(app).get('/api/v1/admin/shadow/runs/00000000-0000-4000-8000-000000000000/geojson?layer=roads').set(admin).expect(400);
  });

  it('is admin-only', async () => {
    const buyer = bearer((await newBuyer(app, providers.sms)).token);
    await request(app).post('/api/v1/admin/shadow/runs').send({ threshold_pct: 20, since_year: 2015 }).expect(401);
    await request(app).post('/api/v1/admin/shadow/runs').set(buyer).send({ threshold_pct: 20, since_year: 2015 }).expect(403);
    await request(app).get('/api/v1/admin/shadow/runs').set(buyer).expect(403);
    await request(app).get('/api/v1/admin/export/shadow/00000000-0000-4000-8000-000000000000.geojson').set(buyer).expect(403);
  });
});
