import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { InventoryLineDto } from '@nurserylink/shared';
import type { inventoryCreateSchema, inventoryUpdateSchema } from '@nurserylink/shared';
import type { Database, DbOrTx } from '../../db/client.js';
import { inventory } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import * as repo from './inventory.repo.js';
import { parseInventoryCsv, type ImportError, type ImportLine } from './inventoryImport.js';

type CreateInput = z.output<typeof inventoryCreateSchema>;
type UpdateInput = z.output<typeof inventoryUpdateSchema>;

export type InventoryLine = InventoryLineDto;

const toLine = (r: repo.InventoryAdminRow): InventoryLine => ({
  id: r.id,
  nursery: { id: r.nursery_id, name: r.nursery_name },
  species: { id: r.species_id, slug: r.species_slug, common_name: r.common_name },
  quantity_available: r.quantity_available,
  unit_price: r.unit_price,
  updated_at: new Date(r.updated_at).toISOString(),
});

export interface ImportChange {
  row: number;
  nursery: string;
  species: string;
  action: 'create' | 'update' | 'unchanged';
  before: { quantity_available: number; unit_price: number } | null;
  after: { quantity_available: number; unit_price: number };
}

export interface ImportResult {
  committed: boolean;
  rows: number;
  errors: ImportError[];
  summary: { create: number; update: number; unchanged: number };
  changes: ImportChange[];
}

export class InventoryService {
  constructor(private readonly deps: { db: Database }) {}

  async listForNursery(nurseryId: string): Promise<InventoryLine[]> {
    return (await repo.listForNursery(this.deps.db, nurseryId)).map(toLine);
  }

  async create(actorId: string, input: CreateInput): Promise<InventoryLine> {
    return this.deps.db.transaction(async tx => {
      const [created] = await tx
        .insert(inventory)
        .values({ nurseryId: input.nursery_id, speciesId: input.species_id, quantityAvailable: input.quantity_available, unitPrice: input.unit_price })
        .onConflictDoNothing()
        .returning({ id: inventory.id });
      if (!created) throw new ConflictError('This nursery already lists this species. Update that stock line instead.');
      const after = await this.mustFind(tx, created.id);
      await writeAudit(tx, { actorId, action: 'inventory.create', entity: 'inventory', entityId: created.id, after });
      return after;
    });
  }

  async update(actorId: string, id: string, input: UpdateInput): Promise<InventoryLine> {
    return this.deps.db.transaction(async tx => {
      const before = await this.mustFind(tx, id, true);
      await tx
        .update(inventory)
        .set({
          ...(input.quantity_available !== undefined ? { quantityAvailable: input.quantity_available } : {}),
          ...(input.unit_price !== undefined ? { unitPrice: input.unit_price } : {}),
        })
        .where(eq(inventory.id, id));
      const after = await this.mustFind(tx, id);
      await writeAudit(tx, { actorId, action: 'inventory.update', entity: 'inventory', entityId: id, before, after });
      return after;
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    await this.deps.db.transaction(async tx => {
      const before = await this.mustFind(tx, id, true);
      if ((await repo.countOrderItems(tx, id)) > 0) {
        throw new ConflictError('This stock line appears in orders. Set its quantity to 0 instead.');
      }
      await tx.delete(inventory).where(eq(inventory.id, id));
      await writeAudit(tx, { actorId, action: 'inventory.delete', entity: 'inventory', entityId: id, before });
    });
  }

  /**
   * CSV stock import. Without commit it is a dry run reporting row-level errors and the changes
   * that would be made. With commit, every row is applied in one transaction, and nothing is
   * applied if any row has an error.
   */
  async importCsv(actorId: string, csv: string, commit: boolean): Promise<ImportResult> {
    const { db } = this.deps;
    const lookups = { nurseries: await repo.allNurseries(db), species: await repo.allSpecies(db) };
    const parsed = parseInventoryCsv(csv, lookups);

    if (!commit || parsed.errors.length) {
      const changes = parsed.errors.length ? [] : await this.diff(db, parsed.lines, false);
      const result = this.result(false, parsed.rowCount, parsed.errors, changes);
      if (commit) throw new ValidationError('The file has errors, so nothing was imported. Fix them and try again.', result);
      return result;
    }

    return db.transaction(async tx => {
      // Lock the affected rows and diff again inside the transaction, so the audit trail is exact
      const changes = await this.diff(tx, parsed.lines, true);
      for (const [i, change] of changes.entries()) {
        if (change.action === 'unchanged') continue;
        const line = parsed.lines[i];
        if (!line) continue;
        const { id } = await repo.upsertInventory(tx, { nurseryId: line.nurseryId, speciesId: line.speciesId, quantity: line.quantity, unitPrice: line.unitPrice });
        await writeAudit(tx, {
          actorId,
          action: change.action === 'create' ? 'inventory.create' : 'inventory.update',
          entity: 'inventory',
          entityId: id,
          before: change.before,
          after: { ...change.after, nursery_id: line.nurseryId, species_slug: line.speciesSlug, source: 'csv_import', row: line.row },
        });
      }
      const result = this.result(true, parsed.rowCount, [], changes);
      await writeAudit(tx, { actorId, action: 'inventory.import', entity: 'inventory', entityId: null, after: { rows: result.rows, summary: result.summary } });
      return result;
    });
  }

  private async diff(db: DbOrTx, lines: ImportLine[], lock: boolean): Promise<ImportChange[]> {
    const existing = await repo.inventoryForPairs(db, lines.map(l => ({ nurseryId: l.nurseryId, speciesId: l.speciesId })), lock);
    const byPair = new Map(existing.map(e => [`${e.nursery_id}:${e.species_id}`, e]));
    return lines.map(line => {
      const current = byPair.get(`${line.nurseryId}:${line.speciesId}`);
      const after = { quantity_available: line.quantity, unit_price: line.unitPrice };
      const before = current ? { quantity_available: current.quantity_available, unit_price: current.unit_price } : null;
      const action = !before ? 'create' : before.quantity_available === after.quantity_available && before.unit_price === after.unit_price ? 'unchanged' : 'update';
      return { row: line.row, nursery: line.nurseryName, species: line.speciesSlug, action, before, after };
    });
  }

  private result(committed: boolean, rows: number, errors: ImportError[], changes: ImportChange[]): ImportResult {
    const count = (action: ImportChange['action']) => changes.filter(c => c.action === action).length;
    return { committed, rows, errors, summary: { create: count('create'), update: count('update'), unchanged: count('unchanged') }, changes };
  }

  private async mustFind(db: DbOrTx, id: string, lock = false): Promise<InventoryLine> {
    const row = await repo.findInventory(db, id, lock);
    if (!row) throw new NotFoundError('Stock line not found');
    return toLine(row);
  }
}
