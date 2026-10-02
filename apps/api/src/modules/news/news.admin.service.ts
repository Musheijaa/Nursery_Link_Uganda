import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { NewsCategory, newsCreateSchema, newsUpdateSchema, PaginationMeta } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { newsPosts } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { NotFoundError } from '../../lib/errors.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import { slugify } from '../../lib/slug.js';

type CreateInput = z.output<typeof newsCreateSchema>;
type UpdateInput = z.output<typeof newsUpdateSchema>;
type NewsRow = typeof newsPosts.$inferSelect;

export const toAdminNews = (r: NewsRow) => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  category: r.category,
  body: r.body,
  cover_url: r.coverUrl,
  is_published: r.isPublished,
  published_at: r.publishedAt?.toISOString() ?? null,
});
export type AdminNews = ReturnType<typeof toAdminNews>;

export class NewsAdminService {
  constructor(private readonly deps: { db: Database }) {}

  /** Every post, including drafts and scheduled ones, newest first. */
  async list(filters: { category?: NewsCategory | undefined; isPublished?: boolean | undefined }, page: Pagination): Promise<{ items: AdminNews[]; meta: PaginationMeta }> {
    const { db } = this.deps;
    const conditions: SQL[] = [];
    if (filters.category) conditions.push(eq(newsPosts.category, filters.category));
    if (filters.isPublished !== undefined) conditions.push(eq(newsPosts.isPublished, filters.isPublished));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(newsPosts).where(where).orderBy(desc(newsPosts.publishedAt), desc(newsPosts.id)).limit(page.limit).offset(toOffset(page));
    const [total] = await db.select({ n: count() }).from(newsPosts).where(where);
    return { items: rows.map(toAdminNews), meta: paginationMeta(page, total?.n ?? 0) };
  }

  async get(id: string): Promise<AdminNews> {
    return toAdminNews(await this.mustFind(this.deps.db, id));
  }

  async create(actorId: string, input: CreateInput): Promise<AdminNews> {
    return this.deps.db.transaction(async tx => {
      const publishedAt = input.published_at ? new Date(input.published_at) : input.is_published ? new Date() : null;
      const [row] = await tx
        .insert(newsPosts)
        .values({
          title: input.title,
          slug: input.slug ?? slugify(input.title),
          category: input.category,
          body: input.body,
          coverUrl: input.cover_url ?? null,
          isPublished: input.is_published,
          publishedAt,
        })
        .returning();
      if (!row) throw new Error('News insert returned no row');
      const after = toAdminNews(row);
      await writeAudit(tx, { actorId, action: 'news.create', entity: 'news_post', entityId: row.id, after });
      return after;
    });
  }

  async update(actorId: string, id: string, input: UpdateInput): Promise<AdminNews> {
    return this.deps.db.transaction(async tx => {
      const before = toAdminNews(await this.mustFind(tx, id, true));
      const set: PgUpdateSetSource<typeof newsPosts> = {};
      if (input.title !== undefined) set.title = input.title;
      if (input.slug !== undefined) set.slug = input.slug;
      if (input.category !== undefined) set.category = input.category;
      if (input.body !== undefined) set.body = input.body;
      if (input.cover_url !== undefined) set.coverUrl = input.cover_url;
      if (input.is_published !== undefined) set.isPublished = input.is_published;
      if (input.published_at !== undefined) set.publishedAt = input.published_at ? new Date(input.published_at) : null;
      // Publishing without a date means "publish now"
      const willBePublished = input.is_published ?? before.is_published;
      const willHaveDate = input.published_at !== undefined ? input.published_at !== null : before.published_at !== null;
      if (willBePublished && !willHaveDate) set.publishedAt = new Date();

      const [row] = await tx.update(newsPosts).set(set).where(eq(newsPosts.id, id)).returning();
      if (!row) throw new NotFoundError('News post not found');
      const after = toAdminNews(row);
      await writeAudit(tx, { actorId, action: 'news.update', entity: 'news_post', entityId: id, before, after });
      return after;
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      const before = toAdminNews(await this.mustFind(tx, id, true));
      await tx.delete(newsPosts).where(eq(newsPosts.id, id));
      await writeAudit(tx, { actorId, action: 'news.delete', entity: 'news_post', entityId: id, before });
    });
  }

  private async mustFind(db: DbOrTx, id: string, lock = false): Promise<NewsRow> {
    const query = db.select().from(newsPosts).where(eq(newsPosts.id, id));
    const [row] = lock ? await query.for('update') : await query;
    if (!row) throw new NotFoundError('News post not found');
    return row;
  }
}
