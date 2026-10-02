import { eq } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { AdminNurseryDto, nurseryCreateSchema, nurseryUpdateSchema, PaginationMeta } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { nurseries } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { LatLng } from '../../lib/geo.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import * as repo from './nurseries.admin.repo.js';

type CreateInput = z.output<typeof nurseryCreateSchema>;
type UpdateInput = z.output<typeof nurseryUpdateSchema>;

/** Shape fixed by adminNurserySchema in @nurserylink/shared (the OpenAPI contract). */
export type AdminNursery = AdminNurseryDto;

export const toAdminNursery = (r: Omit<repo.AdminNurseryRow, 'total'>): AdminNursery => ({
  id: r.id,
  name: r.name,
  type: r.type,
  certification_status: r.certification_status,
  operator_name: r.operator_name,
  contact_phone: r.contact_phone,
  payout_phone: r.payout_phone,
  annual_capacity: r.annual_capacity,
  seed_source: r.seed_source,
  is_active: r.is_active,
  district: { id: r.district_id, name: r.district_name },
  sub_county: { id: r.sub_county_id, name: r.sub_county_name },
  location: { lat: r.lat, lng: r.lng },
  stock_updated_at: r.stock_updated_at ? new Date(r.stock_updated_at).toISOString() : null,
  created_at: new Date(r.created_at).toISOString(),
  updated_at: new Date(r.updated_at).toISOString(),
});

export class NurseriesAdminService {
  constructor(private readonly deps: { db: Database }) {}

  async list(filters: repo.AdminNurseryFilters, page: Pagination): Promise<{ items: AdminNursery[]; meta: PaginationMeta }> {
    const rows = await repo.listNurseries(this.deps.db, filters, page.limit, toOffset(page));
    return { items: rows.map(toAdminNursery), meta: paginationMeta(page, rows[0]?.total ?? 0) };
  }

  async get(id: string): Promise<AdminNursery> {
    const row = await repo.findNursery(this.deps.db, id);
    if (!row) throw new NotFoundError('Nursery not found');
    return toAdminNursery(row);
  }

  async create(actorId: string, input: CreateInput): Promise<AdminNursery> {
    return this.deps.db.transaction(async tx => {
      const boundaries = await this.boundariesFor(tx, input.location);
      const [created] = await tx
        .insert(nurseries)
        .values({
          name: input.name,
          type: input.type,
          districtId: boundaries.district_id,
          subCountyId: boundaries.sub_county_id,
          location: repo.pointSql(input.location),
          operatorName: input.operator_name,
          contactPhone: input.contact_phone,
          payoutPhone: input.payout_phone,
          annualCapacity: input.annual_capacity,
          seedSource: input.seed_source ?? null,
          certificationStatus: input.certification_status,
          isActive: input.is_active,
        })
        .returning({ id: nurseries.id });
      if (!created) throw new Error('Nursery insert returned no row');
      const after = await this.mustFind(tx, created.id);
      await writeAudit(tx, { actorId, action: 'nursery.create', entity: 'nursery', entityId: created.id, after });
      return after;
    });
  }

  async update(actorId: string, id: string, input: UpdateInput): Promise<AdminNursery> {
    return this.deps.db.transaction(async tx => {
      const before = await this.mustFind(tx, id, true);
      const set: PgUpdateSetSource<typeof nurseries> = {};
      if (input.name !== undefined) set.name = input.name;
      if (input.type !== undefined) set.type = input.type;
      if (input.operator_name !== undefined) set.operatorName = input.operator_name;
      if (input.contact_phone !== undefined) set.contactPhone = input.contact_phone;
      if (input.payout_phone !== undefined) set.payoutPhone = input.payout_phone;
      if (input.annual_capacity !== undefined) set.annualCapacity = input.annual_capacity;
      if (input.seed_source !== undefined) set.seedSource = input.seed_source;
      if (input.certification_status !== undefined) set.certificationStatus = input.certification_status;
      if (input.is_active !== undefined) set.isActive = input.is_active;
      if (input.location) {
        // Moving a nursery re-derives its sub-county and district from the boundaries
        const boundaries = await this.boundariesFor(tx, input.location);
        set.location = repo.pointSql(input.location);
        set.subCountyId = boundaries.sub_county_id;
        set.districtId = boundaries.district_id;
      }
      await tx.update(nurseries).set(set).where(eq(nurseries.id, id));
      const after = await this.mustFind(tx, id);
      await writeAudit(tx, { actorId, action: 'nursery.update', entity: 'nursery', entityId: id, before, after });
      return after;
    });
  }

  /** Hard delete, only for nurseries nothing depends on. Otherwise deactivate with is_active=false. */
  async remove(actorId: string, id: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      const before = await this.mustFind(tx, id, true);
      const refs = await repo.countReferences(tx, id);
      if (refs.inventory + refs.orders + refs.campaigns > 0) {
        throw new ConflictError('This nursery has stock, orders or campaigns. Deactivate it instead (is_active: false).', refs);
      }
      await tx.delete(nurseries).where(eq(nurseries.id, id));
      await writeAudit(tx, { actorId, action: 'nursery.delete', entity: 'nursery', entityId: id, before });
    });
  }

  private async boundariesFor(db: DbOrTx, location: LatLng) {
    const found = await repo.boundariesForPoint(db, location);
    if (!found) {
      throw new ValidationError('That location is outside every sub-county we cover', { path: 'location' });
    }
    return found;
  }

  private async mustFind(db: DbOrTx, id: string, lock = false): Promise<AdminNursery> {
    const row = await repo.findNursery(db, id, lock);
    if (!row) throw new NotFoundError('Nursery not found');
    return toAdminNursery(row);
  }
}

