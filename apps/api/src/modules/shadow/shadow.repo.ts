import { sql } from 'drizzle-orm';
import type { ShadowLayer, ShadowRunCreate, ShadowRunParams, ShadowRunStatus } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import type { FeatureCollection, GeoJsonMultiPolygon, LatLng } from '../../lib/geo.js';

export type RunRow = {
  id: string;
  status: ShadowRunStatus;
  params: ShadowRunParams;
  started_by: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
  created_at: Date;
  nurseries: number;
  shadow_zones: number;
  shadow_area_km2: number;
  total: number;
};

const selectRuns = async (db: DbOrTx, where: ReturnType<typeof sql>, limit: number, offset: number): Promise<RunRow[]> =>
  (
    await db.execute<RunRow>(sql`
      SELECT r.id, r.status, r.params, r.started_by, r.started_at, r.finished_at, r.error, r.created_at,
             (SELECT count(DISTINCT nursery_id)::int FROM service_zones WHERE run_id = r.id) AS nurseries,
             (SELECT count(*)::int FROM shadow_zones WHERE run_id = r.id) AS shadow_zones,
             (SELECT COALESCE(sum(area_km2), 0)::float8 FROM shadow_zones WHERE run_id = r.id) AS shadow_area_km2,
             count(*) OVER ()::int AS total
      FROM shadow_runs r
      WHERE ${where}
      ORDER BY r.created_at DESC, r.id
      LIMIT ${limit} OFFSET ${offset}`)
  ).rows;

export const findRun = async (db: DbOrTx, id: string): Promise<RunRow | undefined> => (await selectRuns(db, sql`r.id = ${id}`, 1, 0))[0];

export const listRuns = (db: DbOrTx, limit: number, offset: number) => selectRuns(db, sql`true`, limit, offset);

const sameParams = (p: ShadowRunCreate) =>
  sql`(r.params->>'threshold_pct')::numeric = ${p.threshold_pct} AND (r.params->>'since_year')::int = ${p.since_year}`;

/** A queued or running run with these parameters, so a second request joins it instead of repeating it. */
export const findActiveRun = async (db: DbOrTx, p: ShadowRunCreate): Promise<RunRow | undefined> =>
  (await selectRuns(db, sql`r.status IN ('queued', 'running') AND ${sameParams(p)}`, 1, 0))[0];

/** The latest successful run with these parameters, if it used exactly the current inputs. */
export const findReusableRun = async (db: DbOrTx, p: ShadowRunCreate, inputsHash: string): Promise<RunRow | undefined> => {
  const latest = (await selectRuns(db, sql`r.status = 'succeeded' AND ${sameParams(p)}`, 1, 0))[0];
  return latest?.params.inputs_hash === inputsHash ? latest : undefined;
};

/**
 * Fingerprint of everything a run depends on: where the active nurseries are, and the forest-loss
 * cells. Any change (a nursery added, moved or switched off; the loss data reloaded) changes it.
 */
export const inputsHash = async (db: DbOrTx): Promise<string> => {
  const { rows } = await db.execute<{ hash: string }>(sql`
    SELECT md5(
      COALESCE((SELECT string_agg(id::text || ':' || ST_AsText(location), ',' ORDER BY id) FROM nurseries WHERE is_active), '')
      || '|' ||
      COALESCE((SELECT count(*)::text || ':' || max(id)::text || ':' || sum(loss_pct)::text || ':' || min(loss_year_from)::text || ':' || max(loss_year_to)::text
                FROM forest_loss_cells), '')
    ) AS hash`);
  return rows[0]?.hash ?? '';
};

export const countForestLossCells = async (db: DbOrTx): Promise<number> =>
  (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM forest_loss_cells`)).rows[0]?.n ?? 0;

export const insertRun = async (db: DbOrTx, params: ShadowRunParams, startedBy: string): Promise<string> => {
  const { rows } = await db.execute<{ id: string }>(sql`
    INSERT INTO shadow_runs (params, started_by) VALUES (${JSON.stringify(params)}::jsonb, ${startedBy}) RETURNING id`);
  const id = rows[0]?.id;
  if (!id) throw new Error('Shadow run insert returned no row');
  return id;
};

/** Claims a queued run; returns false if it was already claimed or is gone. */
export const markRunning = async (db: DbOrTx, id: string, hash: string): Promise<boolean> =>
  (
    await db.execute(sql`
      UPDATE shadow_runs SET status = 'running', started_at = now(), error = NULL,
             params = params || jsonb_build_object('inputs_hash', ${hash}::text)
      WHERE id = ${id} AND status = 'queued'
      RETURNING id`)
  ).rows.length > 0;

export const markFinished = async (db: DbOrTx, id: string, status: 'succeeded' | 'failed', error: string | null): Promise<void> => {
  await db.execute(sql`UPDATE shadow_runs SET status = ${status}, finished_at = now(), error = ${error} WHERE id = ${id}`);
};

export const clearRunResults = async (db: DbOrTx, id: string): Promise<void> => {
  await db.execute(sql`DELETE FROM service_zones WHERE run_id = ${id}`);
  await db.execute(sql`DELETE FROM shadow_zones WHERE run_id = ${id}`);
};

type NurseryPoint = { id: string; lat: number; lng: number };

export const activeNurseries = async (db: DbOrTx): Promise<NurseryPoint[]> =>
  (await db.execute<NurseryPoint>(sql`SELECT id, ST_Y(location) AS lat, ST_X(location) AS lng FROM nurseries WHERE is_active ORDER BY id`)).rows;

/**
 * How tightly the hull wraps the reachable points (1 = convex hull). With the GEOS 3.9 bundled in
 * postgis/postgis:16-3.4, PostGIS falls back to its older concave-hull algorithm, which takes
 * ~20 ms per zone at 0.9 but ~1.5 s at 0.7; 0.9 still follows roads that stop short in a direction.
 */
const HULL_TARGET = 0.9;

/**
 * Stores one service area: the concave hull of the reachable sample points, widened by 250 m so
 * roads at the edge are inside and a lone point still makes a polygon.
 */
export const insertServiceZone = async (db: DbOrTx, runId: string, nurseryId: string, km: number, points: LatLng[]): Promise<void> => {
  await db.execute(sql`
    INSERT INTO service_zones (run_id, nursery_id, km, geom)
    SELECT ${runId}, ${nurseryId}, ${km},
           ST_Multi(ST_CollectionExtract(ST_MakeValid(
             ST_Buffer(ST_ConcaveHull(ST_Collect(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)), ${HULL_TARGET}, false)::geography, 250)::geometry
           ), 3))
    FROM jsonb_to_recordset(${JSON.stringify(points)}::jsonb) AS p(lat float8, lng float8)`);
};

/**
 * The Nursery Shadow: 1 km cells that lost at least threshold_pct of their area since since_year
 * and lie entirely outside every nursery's 20 km service area. Touching cells are dissolved into
 * zones; each zone gets its area-weighted loss, its area and the district it mostly falls in.
 */
export const buildShadows = async (db: DbOrTx, runId: string, p: ShadowRunCreate): Promise<void> => {
  await db.execute(sql`
    WITH served AS (
      SELECT ST_Union(geom) AS geom FROM service_zones WHERE run_id = ${runId} AND km = 20
    ),
    loss AS (
      SELECT geom, LEAST(100, sum(loss_pct))::float8 AS pct
      FROM forest_loss_cells WHERE loss_year_from >= ${p.since_year}
      GROUP BY geom
    ),
    marked AS (
      SELECT l.geom, l.pct FROM loss l, served s
      WHERE l.pct >= ${p.threshold_pct} AND (s.geom IS NULL OR NOT ST_Intersects(l.geom, s.geom))
    ),
    parts AS (
      SELECT (ST_Dump(ST_Union(geom))).geom AS geom FROM marked
    )
    INSERT INTO shadow_zones (run_id, geom, loss_pct, area_km2, district_id)
    SELECT ${runId},
           ST_Multi(parts.geom),
           round((SELECT sum(m.pct * ST_Area(m.geom::geography)) / sum(ST_Area(m.geom::geography))
                  FROM marked m WHERE ST_Contains(parts.geom, ST_PointOnSurface(m.geom)))::numeric, 2),
           round((ST_Area(parts.geom::geography) / 1e6)::numeric, 3),
           (SELECT d.id FROM admin_boundaries d
            WHERE d.level = 'district' AND ST_Intersects(d.geom, parts.geom)
            ORDER BY ST_Area(ST_Intersection(d.geom, parts.geom)) DESC LIMIT 1)
    FROM parts`);
};

type ZoneProps = { nursery_id: string; nursery_name: string; km: number };
type ShadowProps = { id: number; loss_pct: number; area_km2: number; district: string | null };
type CellProps = { loss_pct: number; in_shadow: boolean };
export type LayerCollection = FeatureCollection<GeoJsonMultiPolygon, ZoneProps | ShadowProps | CellProps>;

/** The cells layer leaves out cells far below the threshold, and stops at this many features. */
export const MAX_CELL_FEATURES = 20_000;

/** A run's layer as GeoJSON, built in PostGIS (coordinates rounded to 6 decimals, about 0.1 m). */
export const layerGeoJson = async (db: DbOrTx, runId: string, layer: ShadowLayer, p: ShadowRunCreate): Promise<LayerCollection> => {
  const features =
    layer === 'cells'
      ? sql`SELECT json_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(ST_Multi(c.geom), 6)::json,
                   'properties', json_build_object('loss_pct', c.pct, 'in_shadow',
                     EXISTS (SELECT 1 FROM shadow_zones s WHERE s.run_id = ${runId} AND ST_Intersects(s.geom, ST_PointOnSurface(c.geom))))) AS f
            FROM (SELECT geom, round(LEAST(100, sum(loss_pct))::numeric, 2)::float8 AS pct
                  FROM forest_loss_cells WHERE loss_year_from >= ${p.since_year}
                  GROUP BY geom) c
            WHERE c.pct >= ${p.threshold_pct / 2}
            ORDER BY c.pct DESC LIMIT ${MAX_CELL_FEATURES}`
      : layer === 'zones'
      ? sql`SELECT json_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(z.geom, 6)::json,
                   'properties', json_build_object('nursery_id', z.nursery_id, 'nursery_name', n.name, 'km', z.km)) AS f
            FROM service_zones z JOIN nurseries n ON n.id = z.nursery_id
            WHERE z.run_id = ${runId} ORDER BY z.km DESC, n.name`
      : sql`SELECT json_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(s.geom, 6)::json,
                   'properties', json_build_object('id', s.id, 'loss_pct', s.loss_pct::float8, 'area_km2', s.area_km2::float8, 'district', d.name)) AS f
            FROM shadow_zones s LEFT JOIN admin_boundaries d ON d.id = s.district_id
            WHERE s.run_id = ${runId} ORDER BY s.area_km2 DESC, s.id`;
  const { rows } = await db.execute<{ fc: LayerCollection }>(sql`
    SELECT json_build_object('type', 'FeatureCollection', 'features', COALESCE(json_agg(q.f), '[]'::json)) AS fc
    FROM (${features}) q`);
  return rows[0]?.fc ?? { type: 'FeatureCollection', features: [] };
};
