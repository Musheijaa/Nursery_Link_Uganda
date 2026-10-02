import { eq, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { campaignCreateSchema, campaignUpdateSchema, PaginationMeta } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { campaignItems, campaigns } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import * as repo from './campaigns.repo.js';

type CreateInput = z.output<typeof campaignCreateSchema>;
type UpdateInput = z.output<typeof campaignUpdateSchema>;

export class CampaignsAdminService {
  constructor(private readonly deps: { db: Database }) {}

  async list(page: Pagination): Promise<{ items: repo.CampaignRow[]; meta: PaginationMeta }> {
    const rows = await repo.listAllCampaigns(this.deps.db, page.limit, toOffset(page));
    return { items: rows, meta: paginationMeta(page, rows[0]?.total ?? 0) };
  }

  async get(id: string): Promise<repo.CampaignRow> {
    return this.mustFind(this.deps.db, id);
  }

  async create(actorId: string, input: CreateInput): Promise<repo.CampaignRow> {
    return this.deps.db.transaction(async tx => {
      await this.checkReferences(tx, input.nursery_id, input.sub_county_id, input.items.map(i => i.species_id));
      const allocated = input.items.reduce((sum, i) => sum + i.quantity, 0);
      const [created] = await tx
        .insert(campaigns)
        .values({
          nurseryId: input.nursery_id,
          title: input.title,
          funderName: input.funder_name,
          funderType: input.funder_type,
          purpose: input.purpose,
          subCountyId: input.sub_county_id,
          allocatedStock: allocated,
          remainingStock: allocated,
          eligibilityRules: input.eligibility_rules,
          startsAt: new Date(input.starts_at),
          endsAt: new Date(input.ends_at),
          isActive: input.is_active,
        })
        .returning({ id: campaigns.id });
      if (!created) throw new Error('Campaign insert returned no row');
      await tx.insert(campaignItems).values(input.items.map(i => ({ campaignId: created.id, speciesId: i.species_id, quantity: i.quantity })));
      const after = await this.mustFind(tx, created.id);
      await writeAudit(tx, { actorId, action: 'campaign.create', entity: 'campaign', entityId: created.id, after });
      return after;
    });
  }

  /**
   * Changing the items changes the allocation; remaining stock moves by the same amount, so
   * seedlings already given out stay given out. It may never go below zero.
   */
  async update(actorId: string, id: string, input: UpdateInput): Promise<repo.CampaignRow> {
    return this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM campaigns WHERE id = ${id} FOR UPDATE`);
      const before = await this.mustFind(tx, id);
      await this.checkReferences(tx, input.nursery_id, input.sub_county_id, input.items?.map(i => i.species_id));

      const startsAt = input.starts_at ? new Date(input.starts_at) : new Date(before.starts_at);
      const endsAt = input.ends_at ? new Date(input.ends_at) : new Date(before.ends_at);
      if (endsAt <= startsAt) throw new ValidationError('ends_at must be after starts_at', { path: 'ends_at' });

      const set: PgUpdateSetSource<typeof campaigns> = { startsAt, endsAt };
      if (input.nursery_id !== undefined) set.nurseryId = input.nursery_id;
      if (input.title !== undefined) set.title = input.title;
      if (input.funder_name !== undefined) set.funderName = input.funder_name;
      if (input.funder_type !== undefined) set.funderType = input.funder_type;
      if (input.purpose !== undefined) set.purpose = input.purpose;
      if (input.sub_county_id !== undefined) set.subCountyId = input.sub_county_id;
      if (input.eligibility_rules !== undefined) set.eligibilityRules = input.eligibility_rules;
      if (input.is_active !== undefined) set.isActive = input.is_active;

      if (input.items) {
        const allocated = input.items.reduce((sum, i) => sum + i.quantity, 0);
        const remaining = before.remaining_stock + (allocated - before.allocated_stock);
        if (remaining < 0) {
          throw new ConflictError(
            `${String(before.allocated_stock - before.remaining_stock)} seedlings have already been given out; the new allocation must be at least that.`
          );
        }
        set.allocatedStock = allocated;
        set.remainingStock = remaining;
        await tx.delete(campaignItems).where(eq(campaignItems.campaignId, id));
        await tx.insert(campaignItems).values(input.items.map(i => ({ campaignId: id, speciesId: i.species_id, quantity: i.quantity })));
      }

      await tx.update(campaigns).set(set).where(eq(campaigns.id, id));
      const after = await this.mustFind(tx, id);
      await writeAudit(tx, { actorId, action: 'campaign.update', entity: 'campaign', entityId: id, before, after });
      return after;
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      await tx.execute(sql`SELECT 1 FROM campaigns WHERE id = ${id} FOR UPDATE`);
      const before = await this.mustFind(tx, id);
      if ((await repo.countApplications(tx, id)) > 0) {
        throw new ConflictError('People have applied to this campaign. Deactivate it instead (is_active: false).');
      }
      await tx.delete(campaigns).where(eq(campaigns.id, id));
      await writeAudit(tx, { actorId, action: 'campaign.delete', entity: 'campaign', entityId: id, before });
    });
  }

  private async checkReferences(tx: DbOrTx, nurseryId?: string, subCountyId?: string, speciesIds?: string[]) {
    const problems = await repo.checkCampaignReferences(tx, nurseryId, subCountyId, speciesIds);
    if (problems.length) throw new ValidationError('Some references are not valid', problems);
  }

  private async mustFind(db: DbOrTx, id: string): Promise<repo.CampaignRow> {
    const row = await repo.findCampaign(db, id);
    if (!row) throw new NotFoundError('Campaign not found');
    return row;
  }
}
