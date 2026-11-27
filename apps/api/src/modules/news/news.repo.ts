import { sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';

export type NewsListRow = {
  id: string;
  title: string;
  slug: string;
  category: { slug: string; label: string };
  excerpt: string;
  cover_url: string | null;
  published_at: Date;
  total: number;
};

export type NewsPostRow = Omit<NewsListRow, 'excerpt' | 'total'> & { body: string };

/** Published and not scheduled for the future */
const visibleSql = sql`p.is_published AND p.published_at <= now()`;

const categorySql = sql`json_build_object('slug', c.slug, 'label', c.label) AS category`;

export const listNews = async (db: DbOrTx, category: string | undefined, limit: number, offset: number): Promise<NewsListRow[]> => {
  const conditions: SQL[] = [visibleSql];
  if (category) conditions.push(sql`p.category_slug = ${category}`);
  const result = await db.execute<NewsListRow>(sql`
    SELECT p.id, p.title, p.slug, ${categorySql}, p.cover_url, p.published_at,
           CASE WHEN length(p.body) > 200 THEN rtrim(left(p.body, 200)) || '…' ELSE p.body END AS excerpt,
           count(*) OVER ()::int AS total
    FROM news_posts p JOIN news_categories c ON c.slug = p.category_slug
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY p.published_at DESC, p.id
    LIMIT ${limit} OFFSET ${offset}`);
  return result.rows;
};

export const findPublishedNews = async (db: DbOrTx, slug: string): Promise<NewsPostRow | undefined> =>
  (await db.execute<NewsPostRow>(sql`
    SELECT p.id, p.title, p.slug, ${categorySql}, p.body, p.cover_url, p.published_at
    FROM news_posts p JOIN news_categories c ON c.slug = p.category_slug
    WHERE p.slug = ${slug} AND ${visibleSql}`)).rows[0];

export type NewsCategoryRow = { slug: string; label: string; description: string | null; sort_order: number; is_active: boolean; post_count: number };

/** Active categories with their visible posts counted */
export const listNewsCategories = async (db: DbOrTx): Promise<NewsCategoryRow[]> =>
  (
    await db.execute<NewsCategoryRow>(sql`
      SELECT c.slug, c.label, c.description, c.sort_order, c.is_active,
             (SELECT count(*) FROM news_posts p WHERE p.category_slug = c.slug AND ${visibleSql})::int AS post_count
      FROM news_categories c WHERE c.is_active
      ORDER BY c.sort_order, c.label`)
  ).rows;
