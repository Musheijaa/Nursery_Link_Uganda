import { sql, type SQL } from 'drizzle-orm';
import type { BoundaryLevel } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';

export type BoundaryRow = { id: string; name: string; level: BoundaryLevel; parent_id: string | null };

export const listBoundaries = async (db: DbOrTx, filters: { level?: BoundaryLevel | undefined; parentId?: string | undefined }) => {
  const conditions: SQL[] = [sql`true`];
  if (filters.level) conditions.push(sql`level = ${filters.level}`);
  if (filters.parentId) conditions.push(sql`parent_id = ${filters.parentId}`);
  const result = await db.execute<BoundaryRow>(sql`
    SELECT id, name, level, parent_id FROM admin_boundaries
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY level, lower(name)`);
  return result.rows;
};

export const findBoundaryGeoJson = async (db: DbOrTx, id: string) => {
  // 6 decimal places ≈ 0.1 m, plenty for display while keeping payloads small (NFR-9.2)
  const result = await db.execute<BoundaryRow & { geometry: string }>(sql`
    SELECT id, name, level, parent_id, ST_AsGeoJSON(geom, 6) AS geometry FROM admin_boundaries WHERE id = ${id}`);
  return result.rows[0];
};
