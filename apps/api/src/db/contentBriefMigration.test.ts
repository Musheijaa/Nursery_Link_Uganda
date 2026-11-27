import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb, createPool } from './client.js';

/**
 * Migrations 0010–0012 (client content brief) move live data: old species categories into the new
 * many-to-many categories, old notes into the Tree Library profile, news into the new categories,
 * certified nurseries without a verification to pending, and feedback and service requests into the
 * inbox. This builds a database at 0009, fills it the old way, then applies the rest and checks.
 */
const MIGRATIONS = fileURLToPath(new URL('./migrations', import.meta.url));
const DB_NAME = 'nurserylink_migration_test';

const adminPool = createPool(inject('databaseUrl'));
const url = new URL(inject('databaseUrl'));
url.pathname = `/${DB_NAME}`;
const pool = createPool(url.toString());
let upTo0009: string;

/** A copy of the migrations folder whose journal stops after `lastIdx` */
const migrationsUpTo = (lastIdx: number): string => {
  const dir = mkdtempSync(join(tmpdir(), 'nl-migrations-'));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { idx: number }[] };
  journal.entries = journal.entries.filter(e => e.idx <= lastIdx);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
};

const square = (x: number, y: number) => `ST_Multi(ST_GeomFromText('POLYGON((${String(x)} ${String(y)}, ${String(x + 1)} ${String(y)}, ${String(x + 1)} ${String(y + 1)}, ${String(x)} ${String(y + 1)}, ${String(x)} ${String(y)}))', 4326))`;

beforeAll(async () => {
  await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
  upTo0009 = migrationsUpTo(9);
  await migrate(createDb(pool), { migrationsFolder: upTo0009 });

  // The old shape of the data
  await pool.query(`
    INSERT INTO users (id, full_name, phone, password_hash, role) VALUES
      ('00000000-0000-4000-8000-000000000001', 'Grace Buyer', '+256772000001', 'x', 'buyer');
    INSERT INTO admin_boundaries (id, name, level, parent_id, geom) VALUES
      ('00000000-0000-4000-8000-0000000000d1', 'Testdistrict', 'district', NULL, ${square(32, 0)}),
      ('00000000-0000-4000-8000-00000000005a', 'Testcounty', 'sub_county', '00000000-0000-4000-8000-0000000000d1', ${square(32, 0)});
  `);
  await pool.query(`
    INSERT INTO nurseries (id, name, type, district_id, sub_county_id, location, operator_name, contact_phone, payout_phone, annual_capacity, certification_status)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Old Certified', 'private', '00000000-0000-4000-8000-0000000000d1',
            '00000000-0000-4000-8000-00000000005a', ST_SetSRID(ST_MakePoint(32.5, 0.5), 4326), 'Op', '+256772000002', '+256772000002', 100, 'certified');
    INSERT INTO species (id, slug, common_name, scientific_name, category, growth_pace, canopy_notes, root_notes, ecological_zones) VALUES
      ('00000000-0000-4000-8000-0000000000b1', 'old-pine', 'Old pine', 'Pinus test', 'exotic', 'fast', 'Narrow crown.', 'Shallow roots.', '{Highlands}'),
      ('00000000-0000-4000-8000-0000000000b2', 'old-coffee', 'Old coffee', 'Coffea test', 'coffee', 'slow', NULL, NULL, '{}'),
      ('00000000-0000-4000-8000-0000000000b3', 'old-mvule', 'Old mvule', 'Milicia test', 'indigenous', 'moderate', NULL, NULL, '{}');
    INSERT INTO news_posts (title, slug, category, body, is_published, published_at) VALUES
      ('Prices', 'old-market', 'market', 'Body', true, now()),
      ('Grant', 'old-grant', 'grant', 'Body', true, now()),
      ('Rain', 'old-weather', 'weather', 'Body', true, now());
    INSERT INTO feedback (kind, message, contact, page, status) VALUES ('problem', 'The map did not load at all', '0772123456', '/nurseries', 'read');
    INSERT INTO service_requests (user_id, service, location, land_acres, notes, status)
      VALUES ('00000000-0000-4000-8000-000000000001', 'site_visit', 'Seeta, Mukono', 2.5, NULL, 'scheduled');
  `);

  // Now the content-brief migrations
  await migrate(createDb(pool), { migrationsFolder: MIGRATIONS });
});

afterAll(async () => {
  await pool.end();
  await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await adminPool.end();
  rmSync(upTo0009, { recursive: true, force: true });
});

describe('content brief migrations (0010–0012)', () => {
  it('maps old species categories to the new ones (coffee and cocoa to agroforestry, exotic to other)', async () => {
    const { rows } = await pool.query<{ slug: string; categories: string[] }>(`
      SELECT s.slug, array_agg(sc.category_slug ORDER BY sc.category_slug) AS categories
      FROM species s JOIN species_categories sc ON sc.species_id = s.id GROUP BY s.slug ORDER BY s.slug`);
    expect(rows).toEqual([
      { slug: 'old-coffee', categories: ['agroforestry'] },
      { slug: 'old-mvule', categories: ['indigenous'] },
      { slug: 'old-pine', categories: ['other'] },
    ]);
    const { rows: columns } = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'species' AND column_name = 'category'`);
    expect(columns).toHaveLength(0);
  });

  it('moves the old notes into the Tree Library profile and keeps the old columns', async () => {
    const { rows } = await pool.query(`
      SELECT appearance_and_identification, management_practices, growth_characteristics, climate_and_ecology, canopy_notes, root_notes
      FROM species WHERE slug = 'old-pine'`);
    expect(rows[0]).toEqual({
      appearance_and_identification: 'Narrow crown.',
      management_practices: 'Shallow roots.',
      growth_characteristics: 'Grows fast.',
      climate_and_ecology: 'Grows well in: Highlands.',
      canopy_notes: 'Narrow crown.',
      root_notes: 'Shallow roots.',
    });
  });

  it('moves news into the new categories and flags the old market posts for review', async () => {
    const { rows } = await pool.query(`SELECT slug, category_slug, needs_review FROM news_posts ORDER BY slug`);
    expect(rows).toEqual([
      { slug: 'old-grant', category_slug: 'funding-partnerships', needs_review: false },
      { slug: 'old-market', category_slug: 'agroforestry-farming', needs_review: true },
      { slug: 'old-weather', category_slug: 'weather-seasonal', needs_review: false },
    ]);
  });

  it('never leaves a nursery "certified" without a recorded verification', async () => {
    const { rows } = await pool.query(`SELECT certification_status FROM nurseries WHERE name = 'Old Certified'`);
    expect(rows[0]).toEqual({ certification_status: 'pending' });
    await expect(pool.query(`UPDATE nurseries SET certification_status = 'certified' WHERE name = 'Old Certified'`)).rejects.toThrow(/nurseries_certified_is_verified/);
  });

  it('copies feedback and service requests into the inbox with mapped statuses', async () => {
    const { rows } = await pool.query(`SELECT type, status, name, phone, district, services, details, message FROM enquiries ORDER BY type`);
    expect(rows).toEqual([
      {
        type: 'service',
        status: 'in_progress',
        name: 'Grace Buyer',
        phone: '+256772000001',
        district: 'Seeta, Mukono',
        services: ['site visit'],
        details: { old_service: 'site_visit', old_status: 'scheduled', land_acres: 2.5 },
        message: 'Asked for: site visit',
      },
      {
        type: 'feedback',
        status: 'in_progress',
        name: null,
        phone: null,
        district: null,
        services: [],
        details: { kind: 'problem', page: '/nurseries', contact: '0772123456' },
        message: 'The map did not load at all',
      },
    ]);
  });
});
