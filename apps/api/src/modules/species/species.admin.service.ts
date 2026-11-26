import { eq, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { speciesProfileFields, type SpeciesProfileField, type speciesCreateSchema, type speciesUpdateSchema } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { species, speciesLocalNames, speciesMedia, speciesTreeCategories } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { slugify } from '../../lib/slug.js';
import * as repo from './species.repo.js';

type CreateInput = z.output<typeof speciesCreateSchema>;
type UpdateInput = z.output<typeof speciesUpdateSchema>;

const profileKeys = Object.keys(speciesProfileFields) as SpeciesProfileField[];
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

/** The profile fields present in the input, as Drizzle column values (blank text becomes null) */
const profileValues = (input: Partial<Record<SpeciesProfileField, string | null | undefined>>): Record<string, string | null> => {
  const out: Record<string, string | null> = {};
  for (const key of profileKeys) {
    const value = input[key];
    if (value !== undefined) out[toCamel(key)] = value === null || value === '' ? null : value;
  }
  return out;
};

export class SpeciesAdminService {
  constructor(private readonly deps: { db: Database }) {}

  async get(id: string): Promise<repo.SpeciesDetailRow> {
    return this.mustFind(this.deps.db, id);
  }

  async create(actorId: string, input: CreateInput): Promise<repo.SpeciesDetailRow> {
    return this.deps.db.transaction(async tx => {
      const [created] = await tx
        .insert(species)
        .values({
          slug: input.slug ?? slugify(input.common_name),
          commonName: input.common_name,
          scientificName: input.scientific_name,
          growthPace: input.growth_pace,
          heightTimeline: input.height_timeline,
          ecologicalZones: input.ecological_zones,
          ...profileValues(input),
        })
        .returning({ id: species.id });
      if (!created) throw new Error('Species insert returned no row');
      await this.replaceChildren(tx, created.id, input.local_names, input.media);
      await this.replaceCategories(tx, created.id, input.categories);
      const after = await this.mustFind(tx, created.id);
      await writeAudit(tx, { actorId, action: 'species.create', entity: 'species', entityId: created.id, after });
      return after;
    });
  }

  async update(actorId: string, id: string, input: UpdateInput): Promise<repo.SpeciesDetailRow> {
    return this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM species WHERE id = ${id} FOR UPDATE`);
      const before = await this.mustFind(tx, id);
      const set: PgUpdateSetSource<typeof species> = {};
      if (input.common_name !== undefined) set.commonName = input.common_name;
      if (input.scientific_name !== undefined) set.scientificName = input.scientific_name;
      if (input.slug !== undefined) set.slug = input.slug;
      if (input.growth_pace !== undefined) set.growthPace = input.growth_pace;
      if (input.height_timeline !== undefined) set.heightTimeline = input.height_timeline;
      if (input.ecological_zones !== undefined) set.ecologicalZones = input.ecological_zones;
      Object.assign(set, profileValues(input));
      if (Object.keys(set).length) await tx.update(species).set(set).where(eq(species.id, id));
      await this.replaceChildren(tx, id, input.local_names, input.media);
      if (input.categories !== undefined) await this.replaceCategories(tx, id, input.categories);
      const after = await this.mustFind(tx, id);
      await writeAudit(tx, { actorId, action: 'species.update', entity: 'species', entityId: id, before, after });
      return after;
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM species WHERE id = ${id} FOR UPDATE`);
      const before = await this.mustFind(tx, id);
      const refs = await repo.countSpeciesReferences(tx, id);
      if (refs.inventory + refs.orders + refs.campaigns > 0) {
        throw new ConflictError('This species is used by stock, orders or campaigns and cannot be deleted.', refs);
      }
      await tx.delete(species).where(eq(species.id, id));
      await writeAudit(tx, { actorId, action: 'species.delete', entity: 'species', entityId: id, before });
    });
  }

  /** Categories are edited as a whole list, like local names */
  private async replaceCategories(tx: DbOrTx, speciesId: string, categories: string[]) {
    const unknown = await repo.unknownTreeCategories(tx, categories);
    if (unknown.length) throw new ValidationError('Unknown category', [{ path: 'categories', message: `No category ${unknown.join(', ')}` }]);
    await tx.delete(speciesTreeCategories).where(eq(speciesTreeCategories.speciesId, speciesId));
    await tx.insert(speciesTreeCategories).values(categories.map(categorySlug => ({ speciesId, categorySlug })));
  }

  /** Local names and media are edited as whole lists: sending a list replaces the current one. */
  private async replaceChildren(
    tx: DbOrTx,
    speciesId: string,
    localNames: { language: string; name: string }[] | undefined,
    media: { url: string; caption?: string | null | undefined }[] | undefined
  ) {
    if (localNames !== undefined) {
      await tx.delete(speciesLocalNames).where(eq(speciesLocalNames.speciesId, speciesId));
      if (localNames.length) await tx.insert(speciesLocalNames).values(localNames.map(l => ({ speciesId, ...l })));
    }
    if (media !== undefined) {
      await tx.delete(speciesMedia).where(eq(speciesMedia.speciesId, speciesId));
      if (media.length) {
        await tx.insert(speciesMedia).values(media.map((m, i) => ({ speciesId, url: m.url, caption: m.caption ?? null, sortOrder: i })));
      }
    }
  }

  private async mustFind(db: DbOrTx, id: string): Promise<repo.SpeciesDetailRow> {
    const row = await repo.findSpeciesById(db, id);
    if (!row) throw new NotFoundError('Species not found');
    return row;
  }
}
