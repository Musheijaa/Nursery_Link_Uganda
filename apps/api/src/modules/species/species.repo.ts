import { sql, type SQL } from 'drizzle-orm';
import type { GrowthPace, SpeciesProfileField } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import { containsPattern } from '../../lib/sqlText.js';

export type SpeciesRow = {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  categories: CategoryRef[];
  growth_pace: GrowthPace;
  local_names: { language: string; name: string }[];
  thumbnail_url: string | null;
  nursery_count: number;
  total: number;
};

export type CategoryRef = { slug: string; label: string };

export type SpeciesDetailRow = Omit<SpeciesRow, 'thumbnail_url' | 'total'> & Record<SpeciesProfileField, string | null> & {
  height_timeline: { years: number; height_m: number }[];
  ecological_zones: string[];
  media: { url: string; caption: string | null }[];
  min_price: number | null;
  max_price: number | null;
  reference_price: { ugx: number; pot_inches: number } | null;
};

export interface SpeciesFilters {
  /** In any of these categories (slugs) */
  categories?: string[] | undefined;
  letter?: string | undefined;
  q?: string | undefined;
}

/** A species' categories as [{slug, label}], in the categories' order */
export const speciesCategoriesSql = (speciesId: SQL) => sql`COALESCE((SELECT json_agg(json_build_object('slug', c.slug, 'label', c.label) ORDER BY c.sort_order, c.label)
  FROM species_categories sc JOIN tree_categories c ON c.slug = sc.category_slug WHERE sc.species_id = ${speciesId}), '[]'::json)`;

const profileColumnsSql = sql.raw(`s.botanical_family, s.appearance_and_identification, s.growth_characteristics, s.distribution_and_origin,
  s.soil_conditions, s.rainfall_requirements, s.climate_and_ecology, s.propagation_methods, s.planting_requirements,
  s.recommended_spacing, s.management_practices, s.economic_uses, s.environmental_benefits, s.agroforestry_applications, s.other_uses`);

const localNamesSql = sql`COALESCE((SELECT json_agg(json_build_object('language', l.language, 'name', l.name) ORDER BY l.language)
  FROM species_local_names l WHERE l.species_id = s.id), '[]'::json)`;

/** Active nurseries that have this species in stock */
const nurseryCountSql = sql`(SELECT count(DISTINCT i.nursery_id)::int FROM inventory i JOIN nurseries n ON n.id = i.nursery_id
  WHERE i.species_id = s.id AND i.quantity_available > 0 AND n.is_active)`;

export const listSpecies = async (db: DbOrTx, f: SpeciesFilters, limit: number, offset: number): Promise<SpeciesRow[]> => {
  const conditions: SQL[] = [sql`true`];
  if (f.categories?.length) {
    conditions.push(sql`EXISTS (SELECT 1 FROM species_categories sc WHERE sc.species_id = s.id
      AND sc.category_slug IN (${sql.join(f.categories.map(c => sql`${c}`), sql`, `)}))`);
  }
  if (f.letter) conditions.push(sql`upper(left(s.common_name, 1)) = ${f.letter.toUpperCase()}`);
  if (f.q) {
    const pattern = containsPattern(f.q);
    conditions.push(sql`(s.common_name ILIKE ${pattern} OR s.scientific_name ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM species_local_names l WHERE l.species_id = s.id AND l.name ILIKE ${pattern}))`);
  }
  const result = await db.execute<SpeciesRow>(sql`
    SELECT s.id, s.slug, s.common_name, s.scientific_name, ${speciesCategoriesSql(sql`s.id`)} AS categories, s.growth_pace,
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
    SELECT s.id, s.slug, s.common_name, s.scientific_name, ${speciesCategoriesSql(sql`s.id`)} AS categories, s.growth_pace,
           s.height_timeline, ${profileColumnsSql}, s.ecological_zones,
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

export type TreeCategoryRow = { slug: string; label: string; description: string | null; sort_order: number; is_active: boolean; species_count: number };

export const listTreeCategories = async (db: DbOrTx, activeOnly: boolean): Promise<TreeCategoryRow[]> =>
  (
    await db.execute<TreeCategoryRow>(sql`
      SELECT c.slug, c.label, c.description, c.sort_order, c.is_active,
             (SELECT count(*) FROM species_categories sc WHERE sc.category_slug = c.slug)::int AS species_count
      FROM tree_categories c
      ${activeOnly ? sql`WHERE c.is_active` : sql``}
      ORDER BY c.sort_order, c.label`)
  ).rows;

export const findTreeCategory = async (db: DbOrTx, slug: string): Promise<TreeCategoryRow | undefined> =>
  (await listTreeCategories(db, false)).find(c => c.slug === slug);

/** The slugs among these that don't exist */
export const unknownTreeCategories = async (db: DbOrTx, slugs: string[]): Promise<string[]> => {
  if (!slugs.length) return [];
  const found = (await db.execute<{ slug: string }>(sql`SELECT slug FROM tree_categories WHERE slug IN (${sql.join(slugs.map(c => sql`${c}`), sql`, `)})`)).rows;
  return slugs.filter(c => !found.some(f => f.slug === c));
};
