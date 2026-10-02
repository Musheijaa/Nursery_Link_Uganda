import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { parseConfig } from '../config.js';
import { createPool } from './client.js';

/**
 * DEVELOPMENT ONLY: fills forest_loss_cells with a synthetic pattern, so the Nursery Shadow can be
 * built and demonstrated without downloading Hansen Global Forest Change tiles. The numbers are
 * invented. Real data comes from scripts/forest-loss/forest_loss.py, which replaces this table.
 *
 * Cells are a 0.009° (~1 km) grid over the district, one row per cell per year, like the loader.
 * Loss comes from a few hotspots (spread evenly over their years) plus faint deterministic noise.
 */
export const SAMPLE_SOURCE = 'synthetic_dev_sample';

/**
 * Two hotspots on Koome Island (dry land ~27 km from every sample nursery, so beyond all service
 * areas) and two on the mainland inside the served area. Placed for the official UBOS boundary.
 */
const HOTSPOTS = [
  { lat: -0.13, lng: 32.745, r_km: 2.5, peak: 60, year_from: 2015, year_to: 2022 },
  { lat: -0.12, lng: 32.79, r_km: 2, peak: 48, year_from: 2012, year_to: 2020 },
  { lat: 0.66, lng: 32.94, r_km: 4, peak: 40, year_from: 2008, year_to: 2016 },
  { lat: 0.43, lng: 32.86, r_km: 2.5, peak: 28, year_from: 2017, year_to: 2023 },
];
const STEP = 0.009;

export const loadForestLossSample = async (pool: pg.Pool, district = 'Mukono'): Promise<number> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM forest_loss_cells');
    const { rowCount } = await client.query(
      `WITH d AS (SELECT geom FROM admin_boundaries WHERE level = 'district' AND name = $1),
       origin AS (SELECT floor(ST_XMin(geom) / $2) * $2 AS x0, floor(ST_YMin(geom) / $2) * $2 AS y0,
                         ceil((ST_XMax(geom) - ST_XMin(geom)) / $2)::int + 1 AS nx, ceil((ST_YMax(geom) - ST_YMin(geom)) / $2)::int + 1 AS ny
                  FROM d),
       -- Edges come from integer indices, so neighbouring cells share exactly the same coordinates
       grid AS (SELECT i, j, ST_MakeEnvelope(x0 + i * $2, y0 + j * $2, x0 + (i + 1) * $2, y0 + (j + 1) * $2, 4326) AS g
                FROM origin, generate_series(0, nx) i, generate_series(0, ny) j),
       cells AS (SELECT grid.* FROM grid, d WHERE ST_Intersects(ST_Centroid(grid.g), d.geom)),
       hot AS (SELECT * FROM jsonb_to_recordset($3::jsonb) h(lat float8, lng float8, r_km float8, peak float8, year_from int, year_to int)),
       yearly AS (
         SELECT c.g, y AS year,
                -- The exponent is capped: far out on the lake (the official Mukono boundary includes its share of
                -- Lake Victoria) exp() would otherwise underflow, and the term is 0 there anyway
                COALESCE((SELECT sum(h.peak * exp(-LEAST(power(ST_Distance(ST_Centroid(c.g)::geography, ST_SetSRID(ST_MakePoint(h.lng, h.lat), 4326)::geography) / 1000 / h.r_km, 2), 50))
                                     / (h.year_to - h.year_from + 1))
                          FROM hot h WHERE y BETWEEN h.year_from AND h.year_to), 0)
                -- Faint background clearing in about one cell-year in eight
                + CASE WHEN abs(hashtext(c.i || ':' || c.j || ':' || y)) % 8 = 0 THEN (abs(hashtext(y || ':' || c.i || ':' || c.j)) % 40) / 100.0 ELSE 0 END AS pct
         FROM cells c, generate_series(2001, 2023) y)
       INSERT INTO forest_loss_cells (geom, loss_pct, loss_year_from, loss_year_to)
       SELECT g, round(LEAST(pct, 100)::numeric, 2), year, year FROM yearly WHERE pct >= 0.05`,
      [district, STEP, JSON.stringify(HOTSPOTS)]
    );
    await client.query(
      `INSERT INTO audit_log (actor_id, action, entity, entity_id, after) VALUES (NULL, 'forest_loss.load', 'forest_loss_cells', NULL, $1::jsonb)`,
      [JSON.stringify({ sources: [SAMPLE_SOURCE], area: district, cell_m: 1000, rows: rowCount ?? 0, years: [2001, 2023], note: 'Invented data for development; not Hansen GFC' })]
    );
    await client.query('COMMIT');
    return rowCount ?? 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const config = parseConfig(process.env);
  if (config.NODE_ENV === 'production') {
    console.error('Refusing to load synthetic forest-loss data into a production database');
    process.exit(1);
  }
  const pool = createPool(config.DATABASE_URL);
  try {
    console.log(`Loaded ${String(await loadForestLossSample(pool))} synthetic forest-loss rows (development only; not real data)`);
  } finally {
    await pool.end();
  }
}
