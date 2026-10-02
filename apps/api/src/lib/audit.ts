import type { DbOrTx } from '../db/client.js';
import { auditLog } from '../db/schema.js';

export interface AuditEntry {
  actorId: string | null;
  /** Dotted verb, e.g. "nursery.create", "inventory.import", "order.status_changed" */
  action: string;
  entity: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Appends to the audit trail (NFR-7.2). Call it with the same transaction as the change it
 * records, so the change and its audit row commit or roll back together.
 */
export const writeAudit = async (db: DbOrTx, entry: AuditEntry): Promise<void> => {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
};
