import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { config } from '../config.js';
import { hashPassword } from '../lib/crypto.js';
import { detectNetwork, normaliseUgandanMobile } from '../lib/phone.js';
import { pool, withTransaction } from './pool.js';
import { DISTRICTS } from './seed-data/districts.js';
import { TREE_SPECIES } from './seed-data/species.js';
import { NURSERIES } from './seed-data/nurseries.js';
import { PROGRAMMES } from './seed-data/programmes.js';
import { DISTRICT_DEMAND, FOREST_LOSS_AREAS } from './seed-data/forestData.js';

/** Password for the sample nursery owner accounts, so the owner tools can be tried locally. */
export const SAMPLE_OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'nursery-demo-2026';

const point = (coordinates: [number, number]) => `SRID=4326;POINT(${coordinates[1]} ${coordinates[0]})`;

const mustNormalise = (phone: string) => {
  const normalised = normaliseUgandanMobile(phone);
  if (!normalised) throw new Error(`Invalid phone in seed data: ${phone}`);
  return normalised;
};

const seedReferenceData = async (db: pg.PoolClient) => {
  for (const d of DISTRICTS) {
    await db.query(
      `INSERT INTO districts (name, region, location) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET region = EXCLUDED.region, location = EXCLUDED.location`,
      [d.name, d.region, point(d.coordinates)]
    );
  }

  for (const s of TREE_SPECIES) {
    await db.query(
      `INSERT INTO species (id, common_name, botanical_name, category, is_native, description, uses, regions,
                            altitude_min_m, altitude_max_m, growth_rate, time_to_harvest, planting_tip, image_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         common_name = EXCLUDED.common_name, botanical_name = EXCLUDED.botanical_name, category = EXCLUDED.category,
         is_native = EXCLUDED.is_native, description = EXCLUDED.description, uses = EXCLUDED.uses, regions = EXCLUDED.regions,
         altitude_min_m = EXCLUDED.altitude_min_m, altitude_max_m = EXCLUDED.altitude_max_m, growth_rate = EXCLUDED.growth_rate,
         time_to_harvest = EXCLUDED.time_to_harvest, planting_tip = EXCLUDED.planting_tip, image_key = EXCLUDED.image_key`,
      [s.id, s.commonName, s.botanicalName, s.category, s.isNative, s.description, s.uses, s.regions,
        s.altitudeM[0], s.altitudeM[1], s.growthRate, s.timeToHarvest, s.plantingTip, s.image]
    );
    await db.query('DELETE FROM species_local_names WHERE species_id = $1', [s.id]);
    for (const l of s.localNames) {
      await db.query('INSERT INTO species_local_names (species_id, language, name) VALUES ($1, $2, $3)', [s.id, l.language, l.name]);
    }
  }

  for (const d of DISTRICT_DEMAND) {
    await db.query(
      `INSERT INTO district_demand (district_id, annual_demand, forest_loss_ha)
       SELECT id, $2, $3 FROM districts WHERE name = $1
       ON CONFLICT (district_id) DO UPDATE SET annual_demand = EXCLUDED.annual_demand, forest_loss_ha = EXCLUDED.forest_loss_ha`,
      [d.district, d.annualDemand, d.forestLossHa]
    );
  }

  for (const a of FOREST_LOSS_AREAS) {
    await db.query(
      `INSERT INTO forest_loss_areas (id, name, district_id, location, radius_km, forest_loss_ha, drivers, recommended_species_ids)
       SELECT $1, $2, id, $4, $5, $6, $7, $8 FROM districts WHERE name = $3
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, district_id = EXCLUDED.district_id, location = EXCLUDED.location,
         radius_km = EXCLUDED.radius_km, forest_loss_ha = EXCLUDED.forest_loss_ha, drivers = EXCLUDED.drivers,
         recommended_species_ids = EXCLUDED.recommended_species_ids`,
      [a.id, a.name, a.district, point(a.coordinates), a.radiusKm, a.forestLossHa, a.drivers, a.recommendedSpeciesIds]
    );
  }
};

const upsertUser = async (db: pg.PoolClient, phone: string, name: string, role: 'nursery_owner' | 'admin', passwordHash: string) => {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (phone, name, role, password_hash) VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [phone, name, role, passwordHash]
  );
  return rows[0].id;
};

/** Sample nurseries are inserted once; existing ones are left alone so local edits and orders survive re-seeding. */
const seedSampleNurseries = async (db: pg.PoolClient) => {
  const ownerHash = await hashPassword(SAMPLE_OWNER_PASSWORD);

  for (const n of NURSERIES) {
    const existing = await db.query('SELECT 1 FROM nurseries WHERE slug = $1', [n.id]);
    if (existing.rowCount) continue;

    const phone = mustNormalise(n.phone);
    const ownerId = await upsertUser(db, phone, n.operatorName, 'nursery_owner', ownerHash);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO nurseries (slug, owner_id, name, operator_name, phone, payout_phone, payout_network, district_id, sub_county,
                              village, location, registration_type, registration_number, established_year, description,
                              opening_hours, delivery_methods, status)
       SELECT $1, $2, $3, $4, $5, $5, $6, d.id, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active'
       FROM districts d WHERE d.name = $7
       RETURNING id`,
      [n.id, ownerId, n.name, n.operatorName, phone, detectNetwork(phone) ?? 'MTN MoMo', n.district, n.subCounty, n.village,
        point(n.coordinates), n.registration, n.registrationNumber, n.established, n.description, n.openingHours, n.deliveryMethods]
    );
    if (!rows[0]) throw new Error(`Unknown district for nursery ${n.id}: ${n.district}`);

    for (const b of n.batches) {
      await db.query(
        `INSERT INTO seedling_batches (nursery_id, species_id, seedling_type, age_months, height_cm, unit_price_ugx, quantity_available, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [rows[0].id, b.speciesId, b.seedlingType, b.ageMonths, b.heightCm, b.unitPriceUGX, b.quantityAvailable, b.status]
      );
    }
  }
};

const seedProgrammes = async (db: pg.PoolClient) => {
  for (const p of PROGRAMMES) {
    const existing = await db.query('SELECT 1 FROM programmes WHERE id = $1', [p.id]);
    if (existing.rowCount) continue;

    await db.query(
      `INSERT INTO programmes (id, title, sponsor_name, sponsor_type, description, max_per_applicant, total_seedlings,
                               seedlings_claimed, requirements, deadline, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.id, p.title, p.sponsorName, p.sponsorType, p.description, p.maxPerApplicant, p.totalSeedlings,
        p.seedlingsClaimed, p.requirements, p.deadline, p.status]
    );
    for (const district of p.districts) {
      await db.query(
        'INSERT INTO programme_districts (programme_id, district_id) SELECT $1, id FROM districts WHERE name = $2',
        [p.id, district]
      );
    }
    for (const speciesId of p.speciesIds) {
      await db.query('INSERT INTO programme_species (programme_id, species_id) VALUES ($1, $2)', [p.id, speciesId]);
    }
    for (const slug of p.collectionNurseryIds) {
      await db.query(
        'INSERT INTO programme_collection_nurseries (programme_id, nursery_id) SELECT $1, id FROM nurseries WHERE slug = $2',
        [p.id, slug]
      );
    }
  }
};

const seedAdmin = async (db: pg.PoolClient) => {
  if (!config.ADMIN_PHONE || !config.ADMIN_PASSWORD) return null;
  const phone = mustNormalise(config.ADMIN_PHONE);
  await upsertUser(db, phone, 'Site administrator', 'admin', await hashPassword(config.ADMIN_PASSWORD));
  return phone;
};

export const seed = async ({ sampleData = true } = {}) =>
  withTransaction(async db => {
    await seedReferenceData(db);
    if (sampleData) {
      await seedSampleNurseries(db);
      await seedProgrammes(db);
    }
    return { adminPhone: await seedAdmin(db) };
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(({ adminPhone }) => {
      console.log('Seed complete.');
      console.log(`  Sample nursery owners sign in with their nursery phone and password "${SAMPLE_OWNER_PASSWORD}".`);
      if (adminPhone) console.log(`  Admin: ${adminPhone} with ADMIN_PASSWORD from .env`);
    })
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => pool.end());
}
