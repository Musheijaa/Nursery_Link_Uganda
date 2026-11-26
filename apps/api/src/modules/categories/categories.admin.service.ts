import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { categoryCreateSchema, categoryUpdateSchema } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { slugify } from '../../lib/slug.js';

type CreateInput = z.output<typeof categoryCreateSchema>;
type UpdateInput = z.output<typeof categoryUpdateSchema>;

/** Tree categories (Fruit Trees…) and news categories (Policy & Sector News…) share one shape. */
export type CategoryKind = 'tree' | 'news';

export type AdminCategory = {
  slug: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  /** Trees in a tree category; posts in a news category */
  uses: number;
};

const table = { tree: sql.raw('tree_categories'), news: sql.raw('news_categories') } as const;
const usesSql = {
  tree: sql`(SELECT count(*) FROM species_categories x WHERE x.category_slug = c.slug)::int`,
  news: sql`(SELECT count(*) FROM news_posts x WHERE x.category_slug = c.slug)::int`,
} as const;

export class CategoriesAdminService {
  constructor(private readonly deps: { db: Database }) {}

  async list(kind: CategoryKind): Promise<AdminCategory[]> {
    return this.select(this.deps.db, kind);
  }

  async create(actorId: string, kind: CategoryKind, input: CreateInput): Promise<AdminCategory> {
    return this.deps.db.transaction(async tx => {
      const slug = input.slug ?? slugify(input.label);
      await tx.execute(sql`
        INSERT INTO ${table[kind]} (slug, label, description, sort_order, is_active)
        VALUES (${slug}, ${input.label}, ${input.description ?? null}, ${input.sort_order}, ${input.is_active})`);
      const after = await this.mustFind(tx, kind, slug);
      await writeAudit(tx, { actorId, action: `${kind}_category.create`, entity: `${kind}_category`, entityId: slug, after });
      return after;
    });
  }

  async update(actorId: string, kind: CategoryKind, slug: string, input: UpdateInput): Promise<AdminCategory> {
    return this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM ${table[kind]} WHERE slug = ${slug} FOR UPDATE`);
      const before = await this.mustFind(tx, kind, slug);
      await tx.execute(sql`
        UPDATE ${table[kind]} SET
          label = ${input.label ?? before.label},
          description = ${input.description === undefined ? before.description : input.description},
          sort_order = ${input.sort_order ?? before.sort_order},
          is_active = ${input.is_active ?? before.is_active}
        WHERE slug = ${slug}`);
      const after = await this.mustFind(tx, kind, slug);
      await writeAudit(tx, { actorId, action: `${kind}_category.update`, entity: `${kind}_category`, entityId: slug, before, after });
      return after;
    });
  }

  /** Only an unused category can be deleted; otherwise switch it off. */
  async remove(actorId: string, kind: CategoryKind, slug: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM ${table[kind]} WHERE slug = ${slug} FOR UPDATE`);
      const before = await this.mustFind(tx, kind, slug);
      if (before.uses > 0) {
        throw new ConflictError(
          `This category is used by ${String(before.uses)} ${kind === 'tree' ? 'trees' : 'posts'} and cannot be deleted. Switch it off instead.`,
          { uses: before.uses }
        );
      }
      await tx.execute(sql`DELETE FROM ${table[kind]} WHERE slug = ${slug}`);
      await writeAudit(tx, { actorId, action: `${kind}_category.delete`, entity: `${kind}_category`, entityId: slug, before });
    });
  }

  private async select(db: DbOrTx, kind: CategoryKind, slug?: string): Promise<AdminCategory[]> {
    return (
      await db.execute<AdminCategory>(sql`
        SELECT c.slug, c.label, c.description, c.sort_order, c.is_active, ${usesSql[kind]} AS uses
        FROM ${table[kind]} c
        ${slug === undefined ? sql`` : sql`WHERE c.slug = ${slug}`}
        ORDER BY c.sort_order, c.label`)
    ).rows;
  }

  private async mustFind(db: DbOrTx, kind: CategoryKind, slug: string): Promise<AdminCategory> {
    const [row] = await this.select(db, kind, slug);
    if (!row) throw new NotFoundError('Category not found');
    return row;
  }
}
