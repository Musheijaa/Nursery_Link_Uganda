import { sql, type SQL } from 'drizzle-orm';
import type { BoundaryLevel } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import { escapeLike } from '../../lib/sqlText.js';

export type SuggestionKind = 'species' | 'nursery' | 'place';

/** Below this a fuzzy match is noise ("katossi" against tree names scores 0). Tuned on the seed data. */
export const MIN_SCORE = 0.3;

/**
 * How well `q` matches `name`: 1 when a word in the name starts with it ("mv" → "Mvule",
 * "fig" → "Barkcloth fig"), 0.9 when it appears anywhere, otherwise pg_trgm's word similarity,
 * which forgives typos ("mvulle" → Mvule 0.63, "eucaliptus" → Eucalyptus 0.57).
 */
const scoreSql = (q: string, name: SQL): SQL => {
  const escaped = escapeLike(q);
  return sql`CASE
    WHEN (' ' || ${name}) ILIKE ${`% ${escaped}%`} THEN 1.0
    WHEN ${name} ILIKE ${`%${escaped}%`} THEN 0.9
    ELSE word_similarity(${q}, ${name}) END`;
};

export type SpeciesSuggestionRow = {
  slug: string;
  common_name: string;
  scientific_name: string;
  /** The name that matched best, when it isn't the common name (a local or scientific name) */
  matched: string;
  nursery_count: number;
  score: number;
};

export const suggestSpecies = async (db: DbOrTx, q: string, limit: number): Promise<SpeciesSuggestionRow[]> => {
  const result = await db.execute<SpeciesSuggestionRow>(sql`
    SELECT s.slug, s.common_name, s.scientific_name, best.name AS matched, best.score::float8 AS score,
           (SELECT count(DISTINCT i.nursery_id)::int FROM inventory i JOIN nurseries n ON n.id = i.nursery_id
            WHERE i.species_id = s.id AND i.quantity_available > 0 AND n.is_active) AS nursery_count
    FROM species s
    CROSS JOIN LATERAL (
      SELECT names.name, ${scoreSql(q, sql`names.name`)} AS score
      FROM (SELECT s.common_name AS name, 0 AS pref
            UNION ALL SELECT s.scientific_name, 1
            UNION ALL SELECT l.name, 2 FROM species_local_names l WHERE l.species_id = s.id) names
      ORDER BY score DESC, names.pref
      LIMIT 1
    ) best
    WHERE best.score >= ${MIN_SCORE}
    ORDER BY best.score DESC, length(s.common_name), lower(s.common_name)
    LIMIT ${limit}`);
  return result.rows;
};

export type NurserySuggestionRow = { id: string; name: string; sub_county_name: string; district_name: string; score: number };

export const suggestNurseries = async (db: DbOrTx, q: string, limit: number): Promise<NurserySuggestionRow[]> => {
  const result = await db.execute<NurserySuggestionRow>(sql`
    SELECT * FROM (
      SELECT n.id, n.name, sc.name AS sub_county_name, d.name AS district_name, (${scoreSql(q, sql`n.name`)})::float8 AS score
      FROM nurseries n
      JOIN admin_boundaries sc ON sc.id = n.sub_county_id
      JOIN admin_boundaries d ON d.id = n.district_id
      WHERE n.is_active
    ) m
    WHERE m.score >= ${MIN_SCORE}
    ORDER BY m.score DESC, length(m.name), lower(m.name)
    LIMIT ${limit}`);
  return result.rows;
};

export type PlaceSuggestionRow = {
  id: string;
  name: string;
  level: BoundaryLevel;
  parent_id: string | null;
  parent_name: string | null;
  lat: number;
  lng: number;
  score: number;
};

/** Districts and sub-counties, with a point inside each (for moving the map there). */
export const suggestPlaces = async (db: DbOrTx, q: string, limit: number): Promise<PlaceSuggestionRow[]> => {
  const result = await db.execute<PlaceSuggestionRow>(sql`
    SELECT * FROM (
      SELECT b.id, b.name, b.level, b.parent_id, p.name AS parent_name,
             round(ST_Y(ST_PointOnSurface(b.geom))::numeric, 6)::float8 AS lat,
             round(ST_X(ST_PointOnSurface(b.geom))::numeric, 6)::float8 AS lng,
             (${scoreSql(q, sql`b.name`)})::float8 AS score
      FROM admin_boundaries b
      LEFT JOIN admin_boundaries p ON p.id = b.parent_id
    ) m
    WHERE m.score >= ${MIN_SCORE}
    ORDER BY m.score DESC, m.level, lower(m.name)
    LIMIT ${limit}`);
  return result.rows;
};
