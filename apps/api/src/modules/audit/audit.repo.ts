import { sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';

export type AuditRow = {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: Date;
  actor: { id: string; full_name: string; phone: string } | null;
  total: number;
};

export interface AuditFilters {
  entity?: string | undefined;
  entityId?: string | undefined;
  actorId?: string | undefined;
  action?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export const listAudit = async (db: DbOrTx, f: AuditFilters, limit: number, offset: number): Promise<AuditRow[]> => {
  const conditions: SQL[] = [sql`true`];
  if (f.entity) conditions.push(sql`a.entity = ${f.entity}`);
  if (f.entityId) conditions.push(sql`a.entity_id = ${f.entityId}`);
  if (f.actorId) conditions.push(sql`a.actor_id = ${f.actorId}`);
  // "inventory" matches inventory.create, inventory.update, …
  if (f.action) conditions.push(sql`(a.action = ${f.action} OR a.action LIKE ${`${f.action}.%`})`);
  if (f.from) conditions.push(sql`a.created_at >= ${f.from}`);
  if (f.to) conditions.push(sql`a.created_at < ${f.to}`);
  const result = await db.execute<AuditRow>(sql`
    SELECT a.id, a.action, a.entity, a.entity_id, a.before, a.after, a.created_at,
           CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'full_name', u.full_name, 'phone', u.phone) END AS actor,
           count(*) OVER ()::int AS total
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${limit} OFFSET ${offset}`);
  return result.rows;
};
