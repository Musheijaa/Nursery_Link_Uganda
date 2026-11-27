import { eq, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import {
  parsePageContentData,
  type PageContentDto,
  type PageContentKey,
  type PartnerDto,
  type ServiceCategoryDto,
  type pageContentUpdateSchema,
  type partnerCreateSchema,
  type partnerUpdateSchema,
  type serviceCategoryCreateSchema,
  type serviceCategoryUpdateSchema,
} from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { pageContent, partners, serviceCategories, services } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { slugify } from '../../lib/slug.js';
import * as repo from './content.repo.js';

type ServiceCategoryCreate = z.output<typeof serviceCategoryCreateSchema>;
type ServiceCategoryUpdate = z.output<typeof serviceCategoryUpdateSchema>;
type PartnerCreate = z.output<typeof partnerCreateSchema>;
type PartnerUpdate = z.output<typeof partnerUpdateSchema>;
type PageContentUpdate = z.output<typeof pageContentUpdateSchema>;

const toPageContent = (r: repo.PageContentRow): PageContentDto => ({ ...r, updated_at: new Date(r.updated_at).toISOString() });

/**
 * Content the client manages without developers: Expert Services, partner logos and the site copy
 * (page intros, the hero, Donate text, contacts and payment instructions). Every write is audited.
 */
export class ContentService {
  constructor(private readonly deps: { db: Database }) {}

  // ── Expert services ──────────────────────────────────────

  async serviceCategories(activeOnly: boolean): Promise<ServiceCategoryDto[]> {
    return repo.listServiceCategories(this.deps.db, activeOnly);
  }

  async createServiceCategory(actorId: string, input: ServiceCategoryCreate): Promise<ServiceCategoryDto> {
    return this.deps.db.transaction(async tx => {
      const [created] = await tx
        .insert(serviceCategories)
        .values({
          slug: input.slug ?? slugify(input.title),
          title: input.title,
          intro: input.intro,
          icon: input.icon,
          sortOrder: input.sort_order,
          isActive: input.is_active,
        })
        .returning({ id: serviceCategories.id });
      if (!created) throw new Error('Service category insert returned no row');
      await this.replaceServices(tx, created.id, input.services);
      const after = await this.mustFindCategory(tx, created.id);
      await writeAudit(tx, { actorId, action: 'service_category.create', entity: 'service_category', entityId: created.id, after });
      return after;
    });
  }

  async updateServiceCategory(actorId: string, id: string, input: ServiceCategoryUpdate): Promise<ServiceCategoryDto> {
    return this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM service_categories WHERE id = ${id} FOR UPDATE`);
      const before = await this.mustFindCategory(tx, id);
      const set: PgUpdateSetSource<typeof serviceCategories> = {};
      if (input.title !== undefined) set.title = input.title;
      if (input.intro !== undefined) set.intro = input.intro;
      if (input.icon !== undefined) set.icon = input.icon;
      if (input.sort_order !== undefined) set.sortOrder = input.sort_order;
      if (input.is_active !== undefined) set.isActive = input.is_active;
      if (Object.keys(set).length) await tx.update(serviceCategories).set(set).where(eq(serviceCategories.id, id));
      if (input.services !== undefined) await this.replaceServices(tx, id, input.services);
      const after = await this.mustFindCategory(tx, id);
      await writeAudit(tx, { actorId, action: 'service_category.update', entity: 'service_category', entityId: id, before, after });
      return after;
    });
  }

  /** Enquiries keep the titles they were sent with, so deleting a category loses nothing from the inbox. */
  async removeServiceCategory(actorId: string, id: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM service_categories WHERE id = ${id} FOR UPDATE`);
      const before = await this.mustFindCategory(tx, id);
      await tx.delete(serviceCategories).where(eq(serviceCategories.id, id));
      await writeAudit(tx, { actorId, action: 'service_category.delete', entity: 'service_category', entityId: id, before });
    });
  }

  /** Services are edited as a whole list, kept by title so unchanged ones keep their ids */
  private async replaceServices(tx: DbOrTx, categoryId: string, list: { title: string; is_active: boolean }[]) {
    const current = await tx.select().from(services).where(eq(services.categoryId, categoryId));
    const byTitle = new Map(current.map(s => [s.title.toLowerCase(), s]));
    const keep = new Set<string>();
    for (const [i, item] of list.entries()) {
      const existing = byTitle.get(item.title.toLowerCase());
      if (existing) {
        keep.add(existing.id);
        await tx.update(services).set({ title: item.title, isActive: item.is_active, sortOrder: i + 1 }).where(eq(services.id, existing.id));
      } else {
        await tx.insert(services).values({ categoryId, title: item.title, isActive: item.is_active, sortOrder: i + 1 });
      }
    }
    for (const s of current) if (!keep.has(s.id)) await tx.delete(services).where(eq(services.id, s.id));
  }

  private async mustFindCategory(db: DbOrTx, id: string): Promise<ServiceCategoryDto> {
    const [row] = await repo.listServiceCategories(db, false, id);
    if (!row) throw new NotFoundError('Service category not found');
    return row;
  }

  // ── Partners ─────────────────────────────────────────────

  async partners(activeOnly: boolean): Promise<PartnerDto[]> {
    return repo.listPartners(this.deps.db, activeOnly);
  }

  async createPartner(actorId: string, input: PartnerCreate): Promise<PartnerDto> {
    return this.deps.db.transaction(async tx => {
      const [created] = await tx
        .insert(partners)
        .values({ name: input.name, logoUrl: input.logo_url, websiteUrl: input.website_url ?? null, sortOrder: input.sort_order, isActive: input.is_active })
        .returning({ id: partners.id });
      if (!created) throw new Error('Partner insert returned no row');
      const after = await this.mustFindPartner(tx, created.id);
      await writeAudit(tx, { actorId, action: 'partner.create', entity: 'partner', entityId: created.id, after });
      return after;
    });
  }

  async updatePartner(actorId: string, id: string, input: PartnerUpdate): Promise<PartnerDto> {
    return this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM partners WHERE id = ${id} FOR UPDATE`);
      const before = await this.mustFindPartner(tx, id);
      const set: PgUpdateSetSource<typeof partners> = {};
      if (input.name !== undefined) set.name = input.name;
      if (input.logo_url !== undefined) set.logoUrl = input.logo_url;
      if (input.website_url !== undefined) set.websiteUrl = input.website_url;
      if (input.sort_order !== undefined) set.sortOrder = input.sort_order;
      if (input.is_active !== undefined) set.isActive = input.is_active;
      await tx.update(partners).set(set).where(eq(partners.id, id));
      const after = await this.mustFindPartner(tx, id);
      await writeAudit(tx, { actorId, action: 'partner.update', entity: 'partner', entityId: id, before, after });
      return after;
    });
  }

  async removePartner(actorId: string, id: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM partners WHERE id = ${id} FOR UPDATE`);
      const before = await this.mustFindPartner(tx, id);
      await tx.delete(partners).where(eq(partners.id, id));
      await writeAudit(tx, { actorId, action: 'partner.delete', entity: 'partner', entityId: id, before });
    });
  }

  private async mustFindPartner(db: DbOrTx, id: string): Promise<PartnerDto> {
    const [row] = await repo.listPartners(db, false, id);
    if (!row) throw new NotFoundError('Partner not found');
    return row;
  }

  // ── Page content ─────────────────────────────────────────

  async pageContent(): Promise<PageContentDto[]> {
    return (await repo.listPageContent(this.deps.db)).map(toPageContent);
  }

  /** Edits one block of site copy. Structured `data` is checked against its key's shape. */
  async updatePageContent(actorId: string, key: PageContentKey, input: PageContentUpdate): Promise<PageContentDto> {
    let data: Record<string, unknown> | undefined;
    if (input.data !== undefined) {
      const parsed = parsePageContentData(key, input.data);
      if (!parsed.ok) {
        throw new ValidationError('Some details are not valid', parsed.issues.map(i => ({ path: ['data', ...i.path.map(String)].join('.'), message: i.message })));
      }
      data = parsed.data;
    }
    return this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM page_content WHERE key = ${key} FOR UPDATE`);
      const [current] = await repo.listPageContent(tx, key);
      const before = current ? toPageContent(current) : null;
      const values = {
        title: input.title === undefined ? (before?.title ?? null) : input.title,
        subtitle: input.subtitle === undefined ? (before?.subtitle ?? null) : input.subtitle,
        body: input.body === undefined ? (before?.body ?? null) : input.body,
        data: data ?? before?.data ?? {},
        updatedBy: actorId,
      };
      await tx.insert(pageContent).values({ key, ...values }).onConflictDoUpdate({ target: pageContent.key, set: values });
      const [row] = await repo.listPageContent(tx, key);
      if (!row) throw new ConflictError('Page content could not be saved');
      const after = toPageContent(row);
      await writeAudit(tx, { actorId, action: 'page_content.update', entity: 'page_content', entityId: key, before, after });
      return after;
    });
  }
}
