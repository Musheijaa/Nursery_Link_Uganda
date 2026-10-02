import { sql, type SQL } from 'drizzle-orm';
import type { GrowthPace, SpeciesCategory } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import { containsPattern } from '../../lib/sqlText.js';

export type SpeciesRow = {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  category: SpeciesCategory;
  growth_pace: GrowthPace;
  local_names: { language: string; name: string }[];
  thumbnail_url: string | null;
  nursery_count: number;
  total: number;
};

export type SpeciesDetailRow = Omit<SpeciesRow, 'thumbnail_url' | 'total'> & {
  height_timeline: { years: number; height_m: number }[];
  canopy_notes: string | null;
  root_notes: string | null;
  ecological_zones: string[];
  media: { url: string; caption: string | null }[];
  min_price: number | null;
  max_price: number | null;
  reference_price: { ugx: number; pot_inches: number } | null;
};

export interface SpeciesFilters {
  category?: SpeciesCategory | undefined;
  letter?: string | undefined;
  q?: string | undefined;
}

const localNamesSql = sql`COALESCE((SELECT json_agg(json_build_object('language', l.language, 'name', l.name) ORDER BY l.language)
  FROM species_local_names l WHERE l.species_id = s.id), '[]'::json)`;

/** Active nurseries that have this species in stock */
const nurseryCountSql = sql`(SELECT count(DISTINCT i.nursery_id)::int FROM inventory i JOIN nurseries n ON n.id = i.nursery_id
  WHERE i.species_id = s.id AND i.quantity_available > 0 AND n.is_active)`;

export const listSpecies = async (db: DbOrTx, f: SpeciesFilters, limit: number, offset: number): Promise<SpeciesRow[]> => {
  const conditions: SQL[] = [sql`true`];
  if (f.category) conditions.push(sql`s.category = ${f.category}`);
  if (f.letter) conditions.push(sql`upper(left(s.common_name, 1)) = ${f.letter.toUpperCase()}`);
  if (f.q) {
    const pattern = containsPattern(f.q);
    conditions.push(sql`(s.common_name ILIKE ${pattern} OR s.scientific_name ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM species_local_names l WHERE l.species_id = s.id AND l.name ILIKE ${pattern}))`);
  }
  const result = await db.execute<SpeciesRow>(sql`
    SELECT s.id, s.slug, s.common_name, s.scientific_name, s.category, s.growth_pace,
           ${localNamesSql} AS local_names,
           (SELECT m.url FROM species_media m WHERE m.species_id = s.id ORDER BY m.sort_order LIMIT 1) AS thumbnail_url,
           ${nurseryCountSql} AS nursery_count,
           count(*) OVER ()::int AS total
    FROM species s
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY lower(s.common_name)
    LIMIT ${limit} OFFSET ${offset}`);
  return result.rows;
};

export const countSpecies = async (db: DbOrTx): Promise<number> =>
  (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM species`)).rows[0]?.n ?? 0;

const findSpeciesWhere = async (db: DbOrTx, where: SQL): Promise<SpeciesDetailRow | undefined> => {
  const result = await db.execute<SpeciesDetailRow>(sql`
    SELECT s.id, s.slug, s.common_name, s.scientific_name, s.category, s.growth_pace,
           s.height_timeline, s.canopy_notes, s.root_notes, s.ecological_zones,
           ${localNamesSql} AS local_names,
           COALESCE((SELECT json_agg(json_build_object('url', m.url, 'caption', m.caption) ORDER BY m.sort_order)
                     FROM species_media m WHERE m.species_id = s.id), '[]'::json) AS media,
           ${nurseryCountSql} AS nursery_count,
           prices.min_price, prices.max_price,
           CASE WHEN s.reference_price_ugx IS NULL THEN NULL
                ELSE json_build_object('ugx', s.reference_price_ugx, 'pot_inches', s.reference_pot_inches) END AS reference_price
    FROM species s
    LEFT JOIN LATERAL (
      SELECT min(i.unit_price)::int AS min_price, max(i.unit_price)::int AS max_price
      FROM inventory i JOIN nurseries n ON n.id = i.nursery_id
      WHERE i.species_id = s.id AND i.quantity_available > 0 AND n.is_active
    ) prices ON true
    WHERE ${where}`);
  return result.rows[0];
};

export const findSpeciesBySlug = (db: DbOrTx, slug: string) => findSpeciesWhere(db, sql`s.slug = ${slug}`);

export const findSpeciesById = (db: DbOrTx, id: string) => findSpeciesWhere(db, sql`s.id = ${id}`);

export type SpeciesReferences = { inventory: number; orders: number; campaigns: number };

export const countSpeciesReferences = async (db: DbOrTx, id: string): Promise<SpeciesReferences> =>
  (
    await db.execute<SpeciesReferences>(sql`
      SELECT (SELECT count(*) FROM inventory WHERE species_id = ${id})::int AS inventory,
             (SELECT count(*) FROM order_items WHERE species_id = ${id})::int AS orders,
             (SELECT count(*) FROM campaign_items WHERE species_id = ${id})::int AS campaigns`)
  ).rows[0] ?? { inventory: 0, orders: 0, campaigns: 0 };
