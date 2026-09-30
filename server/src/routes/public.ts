import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { badRequest, notFound } from '../lib/errors.js';
import { DeliveryMethod, ROAD_FACTOR, quoteDelivery } from '../services/delivery.js';

export const publicRouter = Router();

// Shared projection for nursery listings and detail. $1 = optional district name to measure distance from.
export const NURSERY_SELECT = `
  SELECT n.id, n.slug, n.name, n.operator_name, n.phone, d.name AS district, d.region, n.sub_county, n.village,
         ST_Y(n.location::geometry) AS lat, ST_X(n.location::geometry) AS lng,
         n.registration_type, n.registration_number, n.established_year, n.description, n.opening_hours,
         n.delivery_methods, n.status,
         CASE WHEN near.location IS NULL THEN NULL
              ELSE round(ST_Distance(n.location, near.location) / 1000 * ${ROAD_FACTOR})::int END AS distance_km,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', b.id, 'speciesId', b.species_id, 'seedlingType', b.seedling_type, 'ageMonths', b.age_months,
             'heightCm', b.height_cm, 'unitPriceUGX', b.unit_price_ugx, 'quantityAvailable', b.quantity_available,
             'status', b.status) ORDER BY b.created_at)
           FROM seedling_batches b WHERE b.nursery_id = n.id
         ), '[]') AS batches
  FROM nurseries n
  JOIN districts d ON d.id = n.district_id
  LEFT JOIN districts near ON near.name = $1
`;

export interface NurseryRow {
  id: string; slug: string; name: string; operator_name: string; phone: string; district: string; region: string;
  sub_county: string; village: string; lat: number; lng: number; registration_type: string; registration_number: string;
  established_year: number; description: string; opening_hours: string; delivery_methods: string[]; status: string;
  distance_km: number | null; batches: unknown[];
}

export const nurseryDto = (n: NurseryRow) => ({
  id: n.id,
  slug: n.slug,
  name: n.name,
  operatorName: n.operator_name,
  phone: n.phone,
  district: n.district,
  region: n.region,
  subCounty: n.sub_county,
  village: n.village,
  coordinates: [n.lat, n.lng] as [number, number],
  registration: n.registration_type,
  registrationNumber: n.registration_number,
  established: n.established_year,
  description: n.description,
  openingHours: n.opening_hours,
  deliveryMethods: n.delivery_methods,
  status: n.status,
  distanceKm: n.distance_km,
  batches: n.batches,
});

publicRouter.get('/districts', async (_req, res) => {
  const { rows } = await query(
    `SELECT name, region, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM districts ORDER BY name`
  );
  res.json(rows.map(r => ({ name: r.name, region: r.region, coordinates: [r.lat, r.lng] })));
});

publicRouter.get('/species', async (_req, res) => {
  const { rows } = await query(`
    SELECT s.*,
      COALESCE((SELECT json_agg(json_build_object('language', l.language, 'name', l.name) ORDER BY l.language)
                FROM species_local_names l WHERE l.species_id = s.id), '[]') AS local_names,
      (SELECT count(DISTINCT b.nursery_id)::int FROM seedling_batches b JOIN nurseries n ON n.id = b.nursery_id
       WHERE b.species_id = s.id AND b.quantity_available > 0 AND n.status = 'active') AS nursery_count,
      (SELECT min(b.unit_price_ugx) FROM seedling_batches b JOIN nurseries n ON n.id = b.nursery_id
       WHERE b.species_id = s.id AND b.quantity_available > 0 AND n.status = 'active') AS lowest_price_ugx
    FROM species s ORDER BY s.common_name`);

  res.json(rows.map(s => ({
    id: s.id,
    commonName: s.common_name,
    botanicalName: s.botanical_name,
    localNames: s.local_names,
    category: s.category,
    isNative: s.is_native,
    description: s.description,
    uses: s.uses,
    regions: s.regions,
    altitudeM: [s.altitude_min_m, s.altitude_max_m],
    growthRate: s.growth_rate,
    timeToHarvest: s.time_to_harvest,
    plantingTip: s.planting_tip,
    image: s.image_key,
    nurseryCount: s.nursery_count,
    lowestPriceUGX: s.lowest_price_ugx,
  })));
});

publicRouter.get('/stats', async (_req, res) => {
  const { rows: [r] } = await query(`
    SELECT count(*)::int AS nurseries, count(DISTINCT n.district_id)::int AS districts,
           (SELECT count(*)::int FROM species) AS species,
           COALESCE((SELECT sum(b.quantity_available) FROM seedling_batches b JOIN nurseries x ON x.id = b.nursery_id WHERE x.status = 'active'), 0)::bigint AS seedlings
    FROM nurseries n WHERE n.status = 'active'`);
  res.json({ nurseries: r.nurseries, districts: r.districts, species: r.species, seedlingsInStock: r.seedlings });
});

const listQuery = z.object({
  species: z.string().max(60).optional(),
  district: z.string().max(60).optional(),
  near: z.string().max(60).optional(),
});

publicRouter.get('/nurseries', async (req, res) => {
  const q = listQuery.parse(req.query);
  const { rows } = await query<NurseryRow>(
    `${NURSERY_SELECT}
     WHERE n.status = 'active'
       AND ($2::text IS NULL OR d.name = $2)
       AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM seedling_batches b WHERE b.nursery_id = n.id AND b.species_id = $3 AND b.quantity_available > 0))
     ORDER BY distance_km NULLS LAST, n.name`,
    [q.near ?? null, q.district ?? null, q.species ?? null]
  );
  res.json(rows.map(nurseryDto));
});

const idOrSlug = (value: string) => (z.uuid().safeParse(value).success ? 'n.id = $2::uuid' : 'n.slug = $2');

publicRouter.get('/nurseries/:id', async (req, res) => {
  const near = typeof req.query.near === 'string' ? req.query.near : null;
  const { rows: [n] } = await query<NurseryRow>(
    `${NURSERY_SELECT} WHERE ${idOrSlug(req.params.id)} AND n.status = 'active'`,
    [near, req.params.id]
  );
  if (!n) throw notFound('Nursery not found');
  res.json(nurseryDto(n));
});

const quoteQuery = z.object({
  district: z.string().min(1).max(60),
  seedlings: z.coerce.number().int().positive().max(10_000_000),
});

publicRouter.get('/nurseries/:id/delivery-quotes', async (req, res) => {
  const q = quoteQuery.parse(req.query);
  const { rows: [n] } = await query<{ delivery_methods: DeliveryMethod[]; road_km: number | null }>(
    `SELECT n.delivery_methods, ST_Distance(n.location, d.location) / 1000 * ${ROAD_FACTOR} AS road_km
     FROM nurseries n LEFT JOIN districts d ON d.name = $1
     WHERE ${idOrSlug(req.params.id)} AND n.status = 'active'`,
    [q.district, req.params.id]
  );
  if (!n) throw notFound('Nursery not found');
  if (n.road_km === null) throw badRequest('Unknown district');
  res.json(n.delivery_methods.map(m => quoteDelivery(m, n.road_km!, q.seedlings)));
});

publicRouter.get('/programmes', async (_req, res) => {
  const { rows } = await query(`
    SELECT p.*,
      COALESCE((SELECT array_agg(d.name ORDER BY d.name) FROM programme_districts pd JOIN districts d ON d.id = pd.district_id WHERE pd.programme_id = p.id), '{}') AS districts,
      COALESCE((SELECT array_agg(ps.species_id ORDER BY ps.species_id) FROM programme_species ps WHERE ps.programme_id = p.id), '{}') AS species_ids,
      COALESCE((SELECT json_agg(json_build_object('id', n.id, 'name', n.name, 'district', d.name) ORDER BY n.name)
                FROM programme_collection_nurseries pc JOIN nurseries n ON n.id = pc.nursery_id JOIN districts d ON d.id = n.district_id
                WHERE pc.programme_id = p.id), '[]') AS collection_nurseries
    FROM programmes p WHERE p.status <> 'Closed' ORDER BY p.status, p.deadline`);

  res.json(rows.map(p => ({
    id: p.id,
    title: p.title,
    sponsorName: p.sponsor_name,
    sponsorType: p.sponsor_type,
    description: p.description,
    districts: p.districts,
    speciesIds: p.species_ids,
    maxPerApplicant: p.max_per_applicant,
    totalSeedlings: p.total_seedlings,
    seedlingsClaimed: p.seedlings_claimed,
    requirements: p.requirements,
    deadline: p.deadline,
    status: p.status,
    collectionNurseries: p.collection_nurseries,
  })));
});

publicRouter.get('/planting-gaps', async (_req, res) => {
  const { rows: districts } = await query(`
    SELECT d.name AS district, d.region, dd.annual_demand, dd.forest_loss_ha,
           count(n.id)::int AS nursery_count,
           COALESCE(sum((SELECT sum(b.quantity_available) FROM seedling_batches b WHERE b.nursery_id = n.id)), 0)::bigint AS supply
    FROM district_demand dd
    JOIN districts d ON d.id = dd.district_id
    LEFT JOIN nurseries n ON n.district_id = d.id AND n.status = 'active'
    GROUP BY d.id, dd.district_id`);

  // Nearest active nursery to each forest-loss area, using the PostGIS KNN operator
  const { rows: areas } = await query(`
    SELECT a.id, a.name, d.name AS district, ST_Y(a.location::geometry) AS lat, ST_X(a.location::geometry) AS lng,
           a.radius_km, a.forest_loss_ha, a.drivers, a.recommended_species_ids, near.name AS nearest_name, near.km AS nearest_km
    FROM forest_loss_areas a
    JOIN districts d ON d.id = a.district_id
    LEFT JOIN LATERAL (
      SELECT n.name, round(ST_Distance(n.location, a.location) / 1000 * ${ROAD_FACTOR})::int AS km
      FROM nurseries n WHERE n.status = 'active' ORDER BY n.location <-> a.location LIMIT 1
    ) near ON true
    ORDER BY a.forest_loss_ha DESC`);

  res.json({
    isIllustrative: true,
    districts: districts
      .map(r => ({
        district: r.district,
        region: r.region,
        annualDemand: r.annual_demand,
        forestLossHa: r.forest_loss_ha,
        nurseryCount: r.nursery_count,
        supply: r.supply,
        coveragePercent: Math.min(100, Math.round((r.supply / Math.max(1, r.annual_demand)) * 100)),
      }))
      .sort((a, b) => a.coveragePercent - b.coveragePercent || b.forestLossHa - a.forestLossHa),
    areas: areas.map(a => ({
      id: a.id,
      name: a.name,
      district: a.district,
      coordinates: [a.lat, a.lng],
      radiusKm: a.radius_km,
      forestLossHa: a.forest_loss_ha,
      drivers: a.drivers,
      recommendedSpeciesIds: a.recommended_species_ids,
      nearestNursery: a.nearest_name ? { name: a.nearest_name, distanceKm: a.nearest_km } : null,
    })),
  });
});
