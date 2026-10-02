import { asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { deliveryRateCreateSchema, deliveryRateUpdateSchema } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { deliveryRates } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { NotFoundError } from '../../lib/errors.js';

type RateRow = typeof deliveryRates.$inferSelect;

const toRate = (r: RateRow) => ({
  id: r.id,
  vehicle: r.vehicle,
  max_items: r.maxItems,
  base_fee: r.baseFee,
  per_km: r.perKm,
  max_km: r.maxKm,
  active: r.active,
});
export type DeliveryRate = ReturnType<typeof toRate>;

export class DeliveryRatesService {
  constructor(private readonly deps: { db: Database }) {}

  async list(): Promise<DeliveryRate[]> {
    return (await this.deps.db.select().from(deliveryRates).orderBy(asc(deliveryRates.vehicle), asc(deliveryRates.maxItems))).map(toRate);
  }

  async create(actorId: string, input: z.output<typeof deliveryRateCreateSchema>): Promise<DeliveryRate> {
    return this.deps.db.transaction(async tx => {
      const [row] = await tx
        .insert(deliveryRates)
        .values({ vehicle: input.vehicle, maxItems: input.max_items, baseFee: input.base_fee, perKm: input.per_km, maxKm: input.max_km, active: input.active })
        .returning();
      if (!row) throw new Error('Delivery rate insert returned no row');
      const after = toRate(row);
      await writeAudit(tx, { actorId, action: 'delivery_rate.create', entity: 'delivery_rate', entityId: row.id, after });
      return after;
    });
  }

  async update(actorId: string, id: string, input: z.output<typeof deliveryRateUpdateSchema>): Promise<DeliveryRate> {
    return this.deps.db.transaction(async tx => {
      const before = toRate(await this.mustFind(tx, id));
      const [row] = await tx
        .update(deliveryRates)
        .set({
          ...(input.vehicle !== undefined ? { vehicle: input.vehicle } : {}),
          ...(input.max_items !== undefined ? { maxItems: input.max_items } : {}),
          ...(input.base_fee !== undefined ? { baseFee: input.base_fee } : {}),
          ...(input.per_km !== undefined ? { perKm: input.per_km } : {}),
          ...(input.max_km !== undefined ? { maxKm: input.max_km } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        })
        .where(eq(deliveryRates.id, id))
        .returning();
      if (!row) throw new NotFoundError('Delivery rate not found');
      const after = toRate(row);
      await writeAudit(tx, { actorId, action: 'delivery_rate.update', entity: 'delivery_rate', entityId: id, before, after });
      return after;
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      const before = toRate(await this.mustFind(tx, id));
      await tx.delete(deliveryRates).where(eq(deliveryRates.id, id));
      await writeAudit(tx, { actorId, action: 'delivery_rate.delete', entity: 'delivery_rate', entityId: id, before });
    });
  }

  private async mustFind(db: DbOrTx, id: string): Promise<RateRow> {
    const [row] = await db.select().from(deliveryRates).where(eq(deliveryRates.id, id)).for('update');
    if (!row) throw new NotFoundError('Delivery rate not found');
    return row;
  }
}
