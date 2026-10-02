import { eq, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { speciesCreateSchema, speciesUpdateSchema } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { species, speciesLocalNames, speciesMedia } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { slugify } from '../../lib/slug.js';
import * as repo from './species.repo.js';

type CreateInput = z.output<typeof speciesCreateSchema>;
type UpdateInput = z.output<typeof speciesUpdateSchema>;

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
          category: input.category,
          growthPace: input.growth_pace,
          heightTimeline: input.height_timeline,
          canopyNotes: input.canopy_notes ?? null,
          rootNotes: input.root_notes ?? null,
          ecologicalZones: input.ecological_zones,
        })
        .returning({ id: species.id });
      if (!created) throw new Error('Species insert returned no row');
      await this.replaceChildren(tx, created.id, input.local_names, input.media);
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
      if (input.category !== undefined) set.category = input.category;
      if (input.growth_pace !== undefined) set.growthPace = input.growth_pace;
      if (input.height_timeline !== undefined) set.heightTimeline = input.height_timeline;
      if (input.canopy_notes !== undefined) set.canopyNotes = input.canopy_notes;
      if (input.root_notes !== undefined) set.rootNotes = input.root_notes;
      if (input.ecological_zones !== undefined) set.ecologicalZones = input.ecological_zones;
      if (Object.keys(set).length) await tx.update(species).set(set).where(eq(species.id, id));
      await this.replaceChildren(tx, id, input.local_names, input.media);
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
