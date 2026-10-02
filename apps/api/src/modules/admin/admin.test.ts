import { RecordingQueue } from '../../jobs/queue.js';
import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { adminToken, bearer, newBuyer } from '../../../test/auth.js';
import { errorOf } from '../../../test/http.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const providers = mockProviders();
const app = createApp({ config: testConfig(inject('databaseUrl')), pool, logger: pino({ level: 'silent' }), providers, queue: new RecordingQueue() });

let admin: Record<string, string>;
let buyer: Record<string, string>;

beforeAll(async () => {
  await prepareTestDatabase(pool);
  admin = bearer(await adminToken(app));
  buyer = bearer((await newBuyer(app, providers.sms)).token);
});
afterAll(() => pool.end());

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a response body in tests
const data = <T>(res: request.Response) => (res.body as { data: T }).data;

const lastAudit = async (entity: string, entityId: string | null) => {
  const { rows } = await pool.query<{ action: string; actor_id: string | null; before: unknown; after: unknown }>(
    `SELECT action, actor_id, before, after FROM audit_log WHERE entity = $1 AND entity_id IS NOT DISTINCT FROM $2 ORDER BY id DESC LIMIT 1`,
    [entity, entityId]
  );
  return rows[0];
};

const idOf = async (sql: string, params: unknown[] = []) => {
  const { rows } = await pool.query<{ id: string }>(sql, params);
  const id = rows[0]?.id;
  if (!id) throw new Error(`No row for ${sql}`);
  return id;
};

// ── RBAC matrix ────────────────────────────────────────────

describe('RBAC on admin route groups', () => {
  const routes = [
    '/api/v1/admin/nurseries',
    '/api/v1/admin/species',
    '/api/v1/admin/news',
    '/api/v1/admin/campaigns',
    '/api/v1/admin/delivery-rates',
    '/api/v1/admin/audit-log',
    '/api/v1/admin/export/nurseries.csv',
    '/api/v1/admin/export/nurseries.geojson',
  ];

  it.each(routes)('%s: visitor 401, buyer 403, admin 200', async route => {
    await request(app).get(route).expect(401);
    await request(app).get(route).set(buyer).expect(403);
    await request(app).get(route).set(admin).expect(200);
  });

  it('protects writes as well as reads', async () => {
    await request(app).post('/api/v1/admin/news').send({}).expect(401);
    await request(app).post('/api/v1/admin/news').set(buyer).send({}).expect(403);
    await request(app).post('/api/v1/admin/inventory/import').set(buyer).set('Content-Type', 'text/csv').send('a,b').expect(403);
  });
});

// ── Nurseries ──────────────────────────────────────────────

describe('admin nurseries', () => {
  const newNursery = {
    name: 'Test Admin Nursery',
    type: 'community',
    location: { lat: 0.358, lng: 32.757 },
    operator_name: 'Nabirye Joan',
    contact_phone: '0772 300 400',
    payout_phone: '+256752300400',
    annual_capacity: 5000,
    seed_source: 'Local mother trees',
  };

  it('creates a nursery, deriving district and sub-county from its location, and audits it', async () => {
    const res = await request(app).post('/api/v1/admin/nurseries').set(admin).send(newNursery).expect(201);
    const created = data<{ id: string; sub_county: { name: string }; district: { name: string }; contact_phone: string; certification_status: string }>(res);
    try {
      expect(created).toMatchObject({
        sub_county: { name: 'Central Division' },
        district: { name: 'Mukono' },
        contact_phone: '+256772300400',
        certification_status: 'unverified',
      });
      const audit = await lastAudit('nursery', created.id);
      expect(audit).toMatchObject({ action: 'nursery.create', before: null, after: { name: 'Test Admin Nursery' } });
      expect(audit?.actor_id).toBeTruthy();

      // Moving it re-derives the boundaries; the audit keeps before and after
      const moved = await request(app).patch(`/api/v1/admin/nurseries/${created.id}`).set(admin)
        .send({ location: { lat: 0.205, lng: 32.8 }, certification_status: 'certified' }).expect(200);
      expect(data<{ sub_county: { name: string }; certification_status: string }>(moved)).toMatchObject({ sub_county: { name: 'Ntenjeru' }, certification_status: 'certified' });
      expect(await lastAudit('nursery', created.id)).toMatchObject({
        action: 'nursery.update',
        before: { sub_county: { name: 'Central Division' } },
        after: { sub_county: { name: 'Ntenjeru' } },
      });

      // Deactivated nurseries disappear from the public catalogue
      await request(app).patch(`/api/v1/admin/nurseries/${created.id}`).set(admin).send({ is_active: false }).expect(200);
      await request(app).get(`/api/v1/nurseries/${created.id}`).expect(404);
      await request(app).get(`/api/v1/admin/nurseries/${created.id}`).set(admin).expect(200);
    } finally {
      await request(app).delete(`/api/v1/admin/nurseries/${created.id}`).set(admin).expect(204);
    }
    expect(await lastAudit('nursery', created.id)).toMatchObject({ action: 'nursery.delete', after: null });
  });

  it('rejects locations outside the covered boundaries and empty updates', async () => {
    const res = await request(app).post('/api/v1/admin/nurseries').set(admin).send({ ...newNursery, location: { lat: -1.29, lng: 36.82 } }).expect(400); // Nairobi, outside Uganda
    expect(errorOf(res).message).toMatch(/outside every sub-county/);
    const id = await idOf(`SELECT id FROM nurseries WHERE name = 'Kasangalabi Tree Nursery'`);
    await request(app).patch(`/api/v1/admin/nurseries/${id}`).set(admin).send({}).expect(400);
  });

  it('will not hard-delete a nursery that has stock', async () => {
    const id = await idOf(`SELECT id FROM nurseries WHERE name = 'Kasangalabi Tree Nursery'`);
    const res = await request(app).delete(`/api/v1/admin/nurseries/${id}`).set(admin).expect(409);
    expect(errorOf(res).message).toMatch(/Deactivate it instead/);
  });

  it('lists all nurseries with filters, including inactive ones', async () => {
    const res = await request(app).get('/api/v1/admin/nurseries?certification_status=certified&limit=100').set(admin).expect(200);
    const body = res.body as { data: { certification_status: string; payout_phone: string }[]; meta: { total: number } };
    expect(body.data.every(n => n.certification_status === 'certified')).toBe(true);
    expect(body.meta.total).toBe(body.data.length);
    expect(body.data[0]?.payout_phone).toMatch(/^\+2567/);
  });
});

// ── Inventory and CSV import ───────────────────────────────

describe('admin inventory', () => {
  let nurseryId = '';
  let mvuleId = '';

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/admin/nurseries').set(admin).send({
      name: 'Import Test Nursery', type: 'private', location: { lat: 0.43, lng: 32.73 }, operator_name: 'Test', contact_phone: '0772300500',
      payout_phone: '0772300500', annual_capacity: 1000,
    }).expect(201);
    nurseryId = data<{ id: string }>(res).id;
    mvuleId = await idOf(`SELECT id FROM species WHERE slug = 'mvule'`);
  });

  afterAll(async () => {
    const lines = data<{ id: string }[]>(await request(app).get(`/api/v1/admin/nurseries/${nurseryId}/inventory`).set(admin).expect(200));
    for (const line of lines) await request(app).delete(`/api/v1/admin/inventory/${line.id}`).set(admin).expect(204);
    await request(app).delete(`/api/v1/admin/nurseries/${nurseryId}`).set(admin).expect(204);
  });

  it('creates, updates and deletes stock lines with an audit trail', async () => {
    const created = data<{ id: string; quantity_available: number }>(
      await request(app).post('/api/v1/admin/inventory').set(admin).send({ nursery_id: nurseryId, species_id: mvuleId, quantity_available: 100, unit_price: 1900 }).expect(201)
    );
    await request(app).post('/api/v1/admin/inventory').set(admin).send({ nursery_id: nurseryId, species_id: mvuleId, quantity_available: 1, unit_price: 1 }).expect(409);

    const updated = data<{ quantity_available: number; unit_price: number }>(
      await request(app).patch(`/api/v1/admin/inventory/${created.id}`).set(admin).send({ quantity_available: 80 }).expect(200)
    );
    expect(updated).toMatchObject({ quantity_available: 80, unit_price: 1900 });
    expect(await lastAudit('inventory', created.id)).toMatchObject({
      action: 'inventory.update', before: { quantity_available: 100 }, after: { quantity_available: 80 },
    });
    await request(app).patch(`/api/v1/admin/inventory/${created.id}`).set(admin).send({ quantity_available: -1 }).expect(400);

    await request(app).delete(`/api/v1/admin/inventory/${created.id}`).set(admin).expect(204);
    expect(await lastAudit('inventory', created.id)).toMatchObject({ action: 'inventory.delete' });
  });

  const csv = () =>
    'nursery_name,species_slug,quantity,unit_price\n' +
    'Import Test Nursery,mvule,300,2100\n' +
    'Import Test Nursery,musizi,1200,850\n';

  const importCsv = (body: string, commit = false) =>
    request(app).post(`/api/v1/admin/inventory/import${commit ? '?commit=true' : ''}`).set(admin).set('Content-Type', 'text/csv').send(body);

  it('dry-runs an import without changing anything', async () => {
    const res = await importCsv(csv()).expect(200);
    expect(data(res)).toMatchObject({
      committed: false,
      rows: 2,
      errors: [],
      summary: { create: 2, update: 0, unchanged: 0 },
      changes: [
        { row: 2, species: 'mvule', action: 'create', before: null, after: { quantity_available: 300, unit_price: 2100 } },
        { row: 3, species: 'musizi', action: 'create' },
      ],
    });
    const lines = data<unknown[]>(await request(app).get(`/api/v1/admin/nurseries/${nurseryId}/inventory`).set(admin));
    expect(lines).toHaveLength(0);
  });

  it('commits an import in one transaction, audits each change, and skips unchanged rows', async () => {
    const first = await importCsv(csv(), true).expect(200);
    expect(data(first)).toMatchObject({ committed: true, summary: { create: 2, update: 0, unchanged: 0 } });

    const second = await importCsv(csv().replace('300,2100', '250,2100'), true).expect(200);
    expect(data(second)).toMatchObject({
      summary: { create: 0, update: 1, unchanged: 1 },
      changes: [{ action: 'update', before: { quantity_available: 300 }, after: { quantity_available: 250 } }, { action: 'unchanged' }],
    });

    const lines = data<{ species: { slug: string }; quantity_available: number }[]>(
      await request(app).get(`/api/v1/admin/nurseries/${nurseryId}/inventory`).set(admin)
    );
    expect(lines.map(l => [l.species.slug, l.quantity_available])).toEqual([['musizi', 1200], ['mvule', 250]]);

    const summary = await lastAudit('inventory', null);
    expect(summary).toMatchObject({ action: 'inventory.import', after: { rows: 2, summary: { create: 0, update: 1, unchanged: 1 } } });
  });

  it('applies nothing when any row has an error', async () => {
    const body = `${csv().replace('300,2100', '999,2100')}Import Test Nursery,baobab,5,100\n`;
    const dry = await importCsv(body).expect(200);
    expect(data<{ errors: { row: number }[] }>(dry).errors).toEqual([{ row: 4, column: 'species_slug', message: 'Unknown species "baobab"' }]);

    const commit = await importCsv(body, true).expect(400);
    expect(errorOf(commit).message).toMatch(/nothing was imported/);
    const lines = data<{ species: { slug: string }; quantity_available: number }[]>(
      await request(app).get(`/api/v1/admin/nurseries/${nurseryId}/inventory`).set(admin)
    );
    expect(lines.find(l => l.species.slug === 'mvule')?.quantity_available).not.toBe(999);
  });

  it('asks for a CSV body', async () => {
    const res = await request(app).post('/api/v1/admin/inventory/import').set(admin).send({ not: 'csv' }).expect(400);
    expect(errorOf(res).message).toMatch(/Content-Type: text\/csv/);
  });
});

// ── Species ────────────────────────────────────────────────

describe('admin species', () => {
  it('creates a species with local names and media, then edits and deletes it', async () => {
    const res = await request(app).post('/api/v1/admin/species').set(admin).send({
      common_name: 'Test Musambya',
      scientific_name: 'Testus exampleus',
      category: 'indigenous',
      growth_pace: 'moderate',
      local_names: [{ language: 'Luganda', name: 'Testname' }],
      media: [{ url: '/images/sp-nsambya.jpg', caption: 'Test photo' }],
    }).expect(201);
    const created = data<{ id: string; slug: string; local_names: unknown[]; media: unknown[] }>(res);
    expect(created).toMatchObject({ slug: 'test-musambya', local_names: [{ language: 'Luganda', name: 'Testname' }], media: [{ url: '/images/sp-nsambya.jpg' }] });

    // Visible in the public library straight away
    await request(app).get('/api/v1/species/test-musambya').expect(200);
    await request(app).post('/api/v1/admin/species').set(admin).send({
      common_name: 'Another', scientific_name: 'X y', category: 'exotic', growth_pace: 'fast', slug: 'test-musambya',
    }).expect(409);

    const updated = await request(app).patch(`/api/v1/admin/species/${created.id}`).set(admin)
      .send({ local_names: [{ language: 'Lusoga', name: 'Other' }], media: [] }).expect(200);
    expect(data(updated)).toMatchObject({ local_names: [{ language: 'Lusoga', name: 'Other' }], media: [] });
    expect(await lastAudit('species', created.id)).toMatchObject({
      action: 'species.update', before: { local_names: [{ language: 'Luganda' }] }, after: { local_names: [{ language: 'Lusoga' }] },
    });

    await request(app).delete(`/api/v1/admin/species/${created.id}`).set(admin).expect(204);
    await request(app).get('/api/v1/species/test-musambya').expect(404);
  });

  it('refuses to delete a species that nurseries stock, and rejects bad media URLs', async () => {
    const mvule = await idOf(`SELECT id FROM species WHERE slug = 'mvule'`);
    await request(app).delete(`/api/v1/admin/species/${mvule}`).set(admin).expect(409);
    await request(app).patch(`/api/v1/admin/species/${mvule}`).set(admin).send({ media: [{ url: 'javascript:alert(1)' }] }).expect(400);
  });
});

// ── News ───────────────────────────────────────────────────

describe('admin news', () => {
  it('keeps drafts private until published', async () => {
    const created = data<{ id: string; slug: string; published_at: string | null }>(
      await request(app).post('/api/v1/admin/news').set(admin).send({ title: 'Test Draft Post', category: 'policy', body: 'Draft body' }).expect(201)
    );
    try {
      expect(created).toMatchObject({ slug: 'test-draft-post', published_at: null });
      await request(app).get('/api/v1/news/test-draft-post').expect(404);
      const listed = await request(app).get('/api/v1/admin/news?is_published=false').set(admin).expect(200);
      expect(data<{ id: string }[]>(listed).map(p => p.id)).toContain(created.id);

      const published = data<{ is_published: boolean; published_at: string | null }>(
        await request(app).patch(`/api/v1/admin/news/${created.id}`).set(admin).send({ is_published: true }).expect(200)
      );
      expect(published.is_published).toBe(true);
      expect(published.published_at).not.toBeNull();
      await request(app).get('/api/v1/news/test-draft-post').expect(200);
    } finally {
      await request(app).delete(`/api/v1/admin/news/${created.id}`).set(admin).expect(204);
    }
    expect(await lastAudit('news_post', created.id)).toMatchObject({ action: 'news.delete' });
  });
});

// ── Campaigns ──────────────────────────────────────────────

describe('admin campaigns', () => {
  it('derives the allocation from items and protects seedlings already given out', async () => {
    const nurseryId = await idOf(`SELECT id FROM nurseries WHERE name = 'Kasawo Farmers'' Nursery'`);
    const subCountyId = await idOf(`SELECT id FROM admin_boundaries WHERE name = 'Kasawo'`);
    const mango = await idOf(`SELECT id FROM species WHERE slug = 'mango'`);
    const jackfruit = await idOf(`SELECT id FROM species WHERE slug = 'jackfruit'`);

    const created = data<{ id: string; allocated_stock: number; remaining_stock: number }>(
      await request(app).post('/api/v1/admin/campaigns').set(admin).send({
        nursery_id: nurseryId, title: 'Test Fruit Campaign', funder_name: 'Test Funder', funder_type: 'foundation',
        purpose: 'Household fruit trees', sub_county_id: subCountyId,
        eligibility_rules: [{ key: 'household_head', label: 'I am the head of the household', type: 'boolean', required: true }],
        starts_at: '2026-09-01T00:00:00+03:00', ends_at: '2026-12-31T23:59:59+03:00',
        items: [{ species_id: mango, quantity: 600 }, { species_id: jackfruit, quantity: 400 }],
      }).expect(201)
    );
    try {
      expect(created).toMatchObject({ allocated_stock: 1000, remaining_stock: 1000 });

      // Pretend 700 were given out, then try to cut the allocation below that
      await pool.query('UPDATE campaigns SET remaining_stock = 300 WHERE id = $1', [created.id]);
      const tooSmall = await request(app).patch(`/api/v1/admin/campaigns/${created.id}`).set(admin)
        .send({ items: [{ species_id: mango, quantity: 500 }] }).expect(409);
      expect(errorOf(tooSmall).message).toMatch(/700 seedlings have already been given out/);

      const grown = data<{ allocated_stock: number; remaining_stock: number }>(
        await request(app).patch(`/api/v1/admin/campaigns/${created.id}`).set(admin)
          .send({ items: [{ species_id: mango, quantity: 1500 }] }).expect(200)
      );
      expect(grown).toMatchObject({ allocated_stock: 1500, remaining_stock: 800 });

      const badDates = await request(app).patch(`/api/v1/admin/campaigns/${created.id}`).set(admin).send({ ends_at: '2026-01-01T00:00:00+03:00' }).expect(400);
      expect(errorOf(badDates).message).toMatch(/ends_at must be after starts_at/);
    } finally {
      await request(app).delete(`/api/v1/admin/campaigns/${created.id}`).set(admin).expect(204);
    }
  });

  it('reports invalid references field by field', async () => {
    const res = await request(app).post('/api/v1/admin/campaigns').set(admin).send({
      nursery_id: '00000000-0000-4000-8000-000000000001', title: 'X', funder_name: 'Y', funder_type: 'ngo', purpose: 'Z',
      sub_county_id: await idOf(`SELECT id FROM admin_boundaries WHERE level = 'district'`),
      starts_at: '2026-09-01T00:00:00+03:00', ends_at: '2026-10-01T00:00:00+03:00',
      items: [{ species_id: '00000000-0000-4000-8000-000000000002', quantity: 1 }],
    }).expect(400);
    expect((errorOf(res).details as { path: string }[]).map(d => d.path)).toEqual(['nursery_id', 'sub_county_id', 'items.0.species_id']);
  });
});

// ── Delivery rates ─────────────────────────────────────────

describe('admin delivery rates', () => {
  it('creates, updates and deletes rates', async () => {
    const created = data<{ id: string }>(
      await request(app).post('/api/v1/admin/delivery-rates').set(admin).send({ vehicle: 'truck', max_items: 50000, base_fee: 150000, per_km: 4000, max_km: 300 }).expect(201)
    );
    const updated = data<{ active: boolean; per_km: number }>(
      await request(app).patch(`/api/v1/admin/delivery-rates/${created.id}`).set(admin).send({ active: false, per_km: 4500 }).expect(200)
    );
    expect(updated).toMatchObject({ active: false, per_km: 4500 });
    await request(app).delete(`/api/v1/admin/delivery-rates/${created.id}`).set(admin).expect(204);
    await request(app).post('/api/v1/admin/delivery-rates').set(admin).send({ vehicle: 'bicycle', max_items: 1, base_fee: 1, per_km: 1, max_km: 1 }).expect(400);
  });
});

// ── Audit log and exports ──────────────────────────────────

describe('audit log', () => {
  it('filters by entity and action prefix, and names the actor', async () => {
    const res = await request(app).get('/api/v1/admin/audit-log?entity=nursery&action=nursery&limit=5').set(admin).expect(200);
    const rows = data<{ action: string; entity: string; actor: { full_name: string } | null; created_at: string }[]>(res);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.entity === 'nursery' && r.action.startsWith('nursery.'))).toBe(true);
    expect(rows[0]?.actor?.full_name).toBe('Test Administrator');
    const times = rows.map(r => r.created_at);
    expect(times).toEqual([...times].sort().reverse());
  });
});

describe('exports (NFR-8.2)', () => {
  it('exports nurseries as CSV without payout numbers', async () => {
    const res = await request(app).get('/api/v1/admin/export/nurseries.csv').set(admin).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="nurseries-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('id,name,type,certification_status,is_active,district,sub_county,latitude,longitude,operator_name,contact_phone,annual_capacity,seed_source,total_stock,stock,updated_at');
    expect(lines.length).toBeGreaterThanOrEqual(16);
    expect(res.text).not.toContain('payout');
    expect(res.text).toMatch(/Katosi Lakeshore Seedlings,private,unverified,true,Mukono,Ntenjeru,0.205,32.8/);
    expect(res.text).toMatch(/mvule:2500@2000/);
  });

  it('exports nurseries as GeoJSON with their inventory', async () => {
    const res = await request(app).get('/api/v1/admin/export/nurseries.geojson').set(admin).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/geo\+json/);
    const collection = JSON.parse(res.text) as { type: string; features: { geometry: { coordinates: number[] }; properties: Record<string, unknown> }[] };
    expect(collection.type).toBe('FeatureCollection');
    const katosi = collection.features.find(f => f.properties.name === 'Katosi Lakeshore Seedlings');
    expect(katosi?.geometry.coordinates).toEqual([32.8, 0.205]);
    expect(katosi?.properties).not.toHaveProperty('payout_phone');
    expect((katosi?.properties.inventory as unknown[]).length).toBe(5);
  });
});
