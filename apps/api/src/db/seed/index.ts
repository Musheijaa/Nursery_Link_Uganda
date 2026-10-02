import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { and, eq, sql } from 'drizzle-orm';
import { toE164UgandaMobile } from '@nurserylink/shared';
import { parseConfig, type Config } from '../../config.js';
import { hashPassword } from '../../lib/password.js';
import { createDb, createPool, type Tx } from '../client.js';
import {
  adminBoundaries,
  campaignItems,
  campaigns,
  deliveryRates,
  inventory,
  newsPosts,
  nurseries,
  species,
  speciesLocalNames,
  speciesMedia,
  users,
} from '../schema.js';
import { DISTRICT_NAME, KOOME_ISLANDS, MUKONO_MAINLAND, SUB_COUNTIES, ringToWkt } from './boundaries.js';
import { SPECIES } from './species.js';
import { NURSERIES } from './nurseries.js';
import { CAMPAIGNS, DELIVERY_RATES, NEWS_POSTS } from './content.js';

export interface SeedOptions {
  admin: { fullName: string; phone: string; email?: string | undefined; password: string };
}


const point = ([lng, lat]: [number, number]) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

export const seedOptionsFromConfig = (config: Config): SeedOptions => {
  const { ADMIN_FULL_NAME, ADMIN_PHONE, ADMIN_EMAIL, ADMIN_PASSWORD } = config;
  if (!ADMIN_FULL_NAME || !ADMIN_PHONE || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_FULL_NAME, ADMIN_PHONE and ADMIN_PASSWORD in .env to seed the first administrator');
  }
  return { admin: { fullName: ADMIN_FULL_NAME, phone: ADMIN_PHONE, email: ADMIN_EMAIL, password: ADMIN_PASSWORD } };
};

const seedBoundaries = async (tx: Tx) => {
  const districtGeom = sql`ST_Multi(ST_Union(
    ST_GeomFromText(${`POLYGON(${ringToWkt(MUKONO_MAINLAND)})`}, 4326),
    ST_GeomFromText(${`POLYGON(${ringToWkt(KOOME_ISLANDS)})`}, 4326)))`;

  const [district] = await tx
    .insert(adminBoundaries)
    .values({ name: DISTRICT_NAME, level: 'district', parentId: null, geom: districtGeom })
    .onConflictDoUpdate({ target: [adminBoundaries.level, adminBoundaries.parentId, adminBoundaries.name], set: { geom: districtGeom } })
    .returning({ id: adminBoundaries.id });
  if (!district) throw new Error('District upsert returned no row');

  // Placeholder sub-county polygons: Voronoi cells of approximate centres, clipped to the district
  const centres = sql.join(
    SUB_COUNTIES.map(s => sql`(${s.name}, ${point(s.centre)})`),
    sql`, `
  );
  await tx.execute(sql`
    WITH centres(name, pt) AS (VALUES ${centres}),
    district AS (SELECT geom FROM admin_boundaries WHERE id = ${district.id}),
    cells AS (
      SELECT (ST_Dump(ST_VoronoiPolygons(ST_Collect(pt), 0, ST_Expand((SELECT ST_Envelope(geom) FROM district), 0.5)))).geom AS cell
      FROM centres
    )
    INSERT INTO admin_boundaries (name, level, parent_id, geom)
    SELECT c.name, 'sub_county', ${district.id}, ST_Multi(ST_CollectionExtract(ST_Intersection(cells.cell, d.geom), 3))
    FROM centres c
    JOIN cells ON ST_Contains(cells.cell, c.pt)
    CROSS JOIN district d
    ON CONFLICT (level, parent_id, name) DO UPDATE SET geom = EXCLUDED.geom
  `);

  return district.id;
};

const seedSpecies = async (tx: Tx) => {
  const ids = new Map<string, string>();
  for (const s of SPECIES) {
    const values = {
      slug: s.slug,
      scientificName: s.scientificName,
      commonName: s.commonName,
      category: s.category,
      growthPace: s.growthPace,
      heightTimeline: s.heightTimeline,
      canopyNotes: s.canopyNotes,
      rootNotes: s.rootNotes,
      ecologicalZones: s.ecologicalZones,
    };
    const [row] = await tx
      .insert(species)
      .values(values)
      .onConflictDoUpdate({ target: species.slug, set: values })
      .returning({ id: species.id });
    if (!row) throw new Error(`Species upsert returned no row: ${s.slug}`);
    ids.set(s.slug, row.id);

    // Local names and media are owned by the seed for seeded species: replace them wholesale
    await tx.delete(speciesLocalNames).where(eq(speciesLocalNames.speciesId, row.id));
    if (s.localNames.length) {
      await tx.insert(speciesLocalNames).values(s.localNames.map(l => ({ speciesId: row.id, ...l })));
    }
    await tx.delete(speciesMedia).where(eq(speciesMedia.speciesId, row.id));
    if (s.media.length) {
      await tx.insert(speciesMedia).values(s.media.map((m, i) => ({ speciesId: row.id, url: m.url, caption: m.caption, sortOrder: i })));
    }
  }
  return ids;
};

/** Nurseries are created once and never overwritten, so admin edits survive re-seeding. */
const seedNurseries = async (tx: Tx, speciesIds: Map<string, string>) => {
  const ids = new Map<string, string>();
  for (const n of NURSERIES) {
    const [existing] = await tx.select({ id: nurseries.id }).from(nurseries).where(eq(nurseries.name, n.name));
    let id = existing?.id;

    if (!id) {
      // The containing sub-county polygon decides both FKs, so location and boundaries always agree
      const found = await tx.execute<{ id: string; parent_id: string }>(sql`
        SELECT id, parent_id FROM admin_boundaries
        WHERE level = 'sub_county' AND ST_Contains(geom, ${point(n.location)})
        LIMIT 1`);
      const subCounty = found.rows[0];
      if (!subCounty) throw new Error(`Nursery "${n.name}" at ${n.location.join(', ')} is outside every sub-county`);

      const [created] = await tx
        .insert(nurseries)
        .values({
          name: n.name,
          type: n.type,
          districtId: subCounty.parent_id,
          subCountyId: subCounty.id,
          location: point(n.location),
          operatorName: n.operatorName,
          contactPhone: n.contactPhone,
          payoutPhone: n.payoutPhone,
          annualCapacity: n.annualCapacity,
          seedSource: n.seedSource,
          certificationStatus: n.certificationStatus,
        })
        .returning({ id: nurseries.id });
      if (!created) throw new Error(`Nursery insert returned no row: ${n.name}`);
      id = created.id;

      for (const [slug, quantityAvailable, unitPrice] of n.inventory) {
        const speciesId = speciesIds.get(slug);
        if (!speciesId) throw new Error(`Unknown species "${slug}" in inventory of ${n.name}`);
        await tx.insert(inventory).values({ nurseryId: id, speciesId, quantityAvailable, unitPrice }).onConflictDoNothing();
      }
    }
    ids.set(n.name, id);
  }
  return ids;
};

const seedContent = async (tx: Tx, districtId: string, speciesIds: Map<string, string>, nurseryIds: Map<string, string>) => {
  for (const rate of DELIVERY_RATES) {
    const [existing] = await tx.select({ id: deliveryRates.id }).from(deliveryRates).where(eq(deliveryRates.vehicle, rate.vehicle));
    if (!existing) await tx.insert(deliveryRates).values(rate);
  }

  for (const post of NEWS_POSTS) {
    await tx
      .insert(newsPosts)
      .values({ ...post, publishedAt: new Date(post.publishedAt), isPublished: true })
      .onConflictDoNothing({ target: newsPosts.slug });
  }

  for (const c of CAMPAIGNS) {
    const [existing] = await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.title, c.title));
    if (existing) continue;

    const nurseryId = nurseryIds.get(c.nurseryName);
    const [subCounty] = await tx
      .select({ id: adminBoundaries.id })
      .from(adminBoundaries)
      .where(and(eq(adminBoundaries.level, 'sub_county'), eq(adminBoundaries.parentId, districtId), eq(adminBoundaries.name, c.subCountyName)));
    if (!nurseryId || !subCounty) throw new Error(`Campaign "${c.title}" refers to an unknown nursery or sub-county`);

    const itemsTotal = c.items.reduce((sum, [, qty]) => sum + qty, 0);
    if (itemsTotal !== c.allocatedStock) throw new Error(`Campaign "${c.title}" items (${itemsTotal}) do not add up to allocated stock`);

    const [created] = await tx
      .insert(campaigns)
      .values({
        nurseryId,
        title: c.title,
        funderName: c.funderName,
        funderType: c.funderType,
        purpose: c.purpose,
        subCountyId: subCounty.id,
        allocatedStock: c.allocatedStock,
        remainingStock: c.remainingStock,
        eligibilityRules: c.eligibilityRules,
        startsAt: new Date(c.startsAt),
        endsAt: new Date(c.endsAt),
      })
      .returning({ id: campaigns.id });
    if (!created) throw new Error(`Campaign insert returned no row: ${c.title}`);

    await tx.insert(campaignItems).values(
      c.items.map(([slug, quantity]) => {
        const speciesId = speciesIds.get(slug);
        if (!speciesId) throw new Error(`Unknown species "${slug}" in campaign ${c.title}`);
        return { campaignId: created.id, speciesId, quantity };
      })
    );
  }
};

/** Creates the first administrator. An existing account keeps its password; only name and role are refreshed. */
const seedAdmin = async (tx: Tx, admin: SeedOptions['admin']) => {
  const phone = toE164UgandaMobile(admin.phone);
  if (!phone) throw new Error(`ADMIN_PHONE is not a valid Ugandan mobile number: ${admin.phone}`);
  await tx
    .insert(users)
    .values({
      fullName: admin.fullName,
      phone,
      email: admin.email?.toLowerCase() ?? null,
      passwordHash: await hashPassword(admin.password),
      role: 'admin',
      phoneVerified: true,
    })
    .onConflictDoUpdate({ target: users.phone, set: { fullName: admin.fullName, role: 'admin' } });
};

/** Seeds reference and sample data. Idempotent: safe to run on every deploy. */
export const seed = async (pool: pg.Pool, options: SeedOptions) => {
  const db = createDb(pool);
  await db.transaction(async tx => {
    const districtId = await seedBoundaries(tx);
    const speciesIds = await seedSpecies(tx);
    const nurseryIds = await seedNurseries(tx, speciesIds);
    await seedContent(tx, districtId, speciesIds, nurseryIds);
    await seedAdmin(tx, options.admin);
  });

  const counts = await pool.query<Record<string, number>>(`
    SELECT
      (SELECT count(*)::int FROM admin_boundaries WHERE level = 'district') AS districts,
      (SELECT count(*)::int FROM admin_boundaries WHERE level = 'sub_county') AS sub_counties,
      (SELECT count(*)::int FROM species) AS species,
      (SELECT count(*)::int FROM nurseries) AS nurseries,
      (SELECT count(*)::int FROM inventory) AS inventory_rows,
      (SELECT count(*)::int FROM delivery_rates) AS delivery_rates,
      (SELECT count(*)::int FROM news_posts) AS news_posts,
      (SELECT count(*)::int FROM campaigns) AS campaigns,
      (SELECT count(*)::int FROM users WHERE role = 'admin') AS admins`);
  return counts.rows[0];
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const config = parseConfig(process.env);
  const pool = createPool(config.DATABASE_URL);
  try {
    console.log('Seeded:', await seed(pool, seedOptionsFromConfig(config)));
  } finally {
    await pool.end();
  }
}
