import { sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';

export type InventoryAdminRow = {
  id: string;
  nursery_id: string;
  nursery_name: string;
  species_id: string;
  species_slug: string;
  common_name: string;
  quantity_available: number;
  unit_price: number;
  updated_at: Date;
};

const select = async (db: DbOrTx, where: ReturnType<typeof sql>, lock = false): Promise<InventoryAdminRow[]> =>
  (
    await db.execute<InventoryAdminRow>(sql`
      SELECT i.id, i.nursery_id, n.name AS nursery_name, i.species_id, s.slug AS species_slug, s.common_name,
             i.quantity_available, i.unit_price, i.updated_at
      FROM inventory i JOIN nurseries n ON n.id = i.nursery_id JOIN species s ON s.id = i.species_id
      WHERE ${where}
      ORDER BY lower(s.common_name)
      ${lock ? sql`FOR UPDATE OF i` : sql``}`)
  ).rows;

export const listForNursery = (db: DbOrTx, nurseryId: string) => select(db, sql`i.nursery_id = ${nurseryId}`);

export const findInventory = async (db: DbOrTx, id: string, lock = false) => (await select(db, sql`i.id = ${id}`, lock))[0];

export const countOrderItems = async (db: DbOrTx, inventoryId: string): Promise<number> =>
  (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM order_items WHERE inventory_id = ${inventoryId}`)).rows[0]?.n ?? 0;

// ── Lookups for the CSV import ─────────────────────────────

export const allNurseries = async (db: DbOrTx) =>
  (await db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM nurseries`)).rows;

export const allSpecies = async (db: DbOrTx) =>
  (await db.execute<{ id: string; slug: string }>(sql`SELECT id, slug FROM species`)).rows;

/** Existing stock lines for the given (nursery, species) pairs; locked when importing for real. */
export const inventoryForPairs = async (db: DbOrTx, pairs: { nurseryId: string; speciesId: string }[], lock: boolean) => {
  if (pairs.length === 0) return [];
  const values = sql.join(pairs.map(p => sql`(${p.nurseryId}::uuid, ${p.speciesId}::uuid)`), sql`, `);
  return (
    await db.execute<{ id: string; nursery_id: string; species_id: string; quantity_available: number; unit_price: number }>(sql`
      SELECT i.id, i.nursery_id, i.species_id, i.quantity_available, i.unit_price
      FROM inventory i JOIN (VALUES ${values}) AS p(nursery_id, species_id)
        ON p.nursery_id = i.nursery_id AND p.species_id = i.species_id
      ${lock ? sql`FOR UPDATE OF i` : sql``}`)
  ).rows;
};

/** Creates or updates one stock line and returns its id and whether it was new. */
export const upsertInventory = async (
  db: DbOrTx,
  v: { nurseryId: string; speciesId: string; quantity: number; unitPrice: number }
): Promise<{ id: string; created: boolean }> => {
  const result = await db.execute<{ id: string; created: boolean }>(sql`
    INSERT INTO inventory (nursery_id, species_id, quantity_available, unit_price)
    VALUES (${v.nurseryId}, ${v.speciesId}, ${v.quantity}, ${v.unitPrice})
    ON CONFLICT (nursery_id, species_id)
    DO UPDATE SET quantity_available = EXCLUDED.quantity_available, unit_price = EXCLUDED.unit_price
    RETURNING id, (xmax = 0) AS created`);
  const row = result.rows[0];
  if (!row) throw new Error('Inventory upsert returned no row');
  return row;
};
