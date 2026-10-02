import { sql, type SQL } from 'drizzle-orm';
import type { NewsCategory } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';

export type NewsListRow = {
  id: string;
  title: string;
  slug: string;
  category: NewsCategory;
  excerpt: string;
  cover_url: string | null;
  published_at: Date;
  total: number;
};

export type NewsPostRow = Omit<NewsListRow, 'excerpt' | 'total'> & { body: string };

/** Published and not scheduled for the future */
const visibleSql = sql`is_published AND published_at <= now()`;

export const listNews = async (db: DbOrTx, category: NewsCategory | undefined, limit: number, offset: number): Promise<NewsListRow[]> => {
  const conditions: SQL[] = [visibleSql];
  if (category) conditions.push(sql`category = ${category}`);
  const result = await db.execute<NewsListRow>(sql`
    SELECT id, title, slug, category, cover_url, published_at,
           CASE WHEN length(body) > 200 THEN rtrim(left(body, 200)) || '…' ELSE body END AS excerpt,
           count(*) OVER ()::int AS total
    FROM news_posts
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY published_at DESC, id
    LIMIT ${limit} OFFSET ${offset}`);
  return result.rows;
};

export const findPublishedNews = async (db: DbOrTx, slug: string): Promise<NewsPostRow | undefined> =>
  (await db.execute<NewsPostRow>(sql`
    SELECT id, title, slug, category, body, cover_url, published_at FROM news_posts WHERE slug = ${slug} AND ${visibleSql}`)).rows[0];
