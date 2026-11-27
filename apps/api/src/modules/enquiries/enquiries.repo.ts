import { sql, type SQL } from 'drizzle-orm';
import type { EnquiryStatus, EnquiryType } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import { containsPattern } from '../../lib/sqlText.js';

export type EnquiryRow = {
  id: string;
  type: EnquiryType;
  status: EnquiryStatus;
  name: string | null;
  phone: string | null;
  email: string | null;
  organization: string | null;
  district: string | null;
  message: string;
  consent: boolean;
  service_category_id: string | null;
  service_category_title: string | null;
  services: string[];
  details: Record<string, string | number | boolean | null>;
  user_id: string | null;
  admin_note: string | null;
  handled_by: string | null;
  created_at: Date;
  updated_at: Date;
  total: number;
};

export interface EnquiryFilters {
  type?: EnquiryType | undefined;
  status?: EnquiryStatus | undefined;
  q?: string | undefined;
}

export interface NewEnquiry {
  type: EnquiryType;
  name: string | null;
  phone: string | null;
  email: string | null;
  organization: string | null;
  district: string | null;
  message: string;
  consent: boolean;
  serviceCategoryId: string | null;
  services: string[];
  details: Record<string, string | number | boolean | null>;
  userId: string | null;
}

export const insertEnquiry = async (db: DbOrTx, e: NewEnquiry): Promise<{ id: string; created_at: Date }> => {
  const result = await db.execute<{ id: string; created_at: Date }>(sql`
    INSERT INTO enquiries (type, name, phone, email, organization, district, message, consent, service_category_id, services, details, user_id)
    VALUES (${e.type}, ${e.name}, ${e.phone}, ${e.email}, ${e.organization}, ${e.district}, ${e.message}, ${e.consent},
            ${e.serviceCategoryId}, ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(e.services)}::jsonb)),
            ${JSON.stringify(e.details)}::jsonb, ${e.userId})
    RETURNING id, created_at`);
  const row = result.rows[0];
  if (!row) throw new Error('Enquiry insert returned no row');
  return row;
};

const whereSql = (f: EnquiryFilters): SQL => {
  const conditions: SQL[] = [sql`true`];
  if (f.type) conditions.push(sql`e.type = ${f.type}`);
  if (f.status) conditions.push(sql`e.status = ${f.status}`);
  if (f.q) {
    const p = containsPattern(f.q);
    conditions.push(sql`(e.name ILIKE ${p} OR e.phone ILIKE ${p} OR e.email ILIKE ${p} OR e.organization ILIKE ${p} OR e.message ILIKE ${p})`);
  }
  return sql.join(conditions, sql` AND `);
};

const select = async (db: DbOrTx, where: SQL, limit: number, offset: number): Promise<EnquiryRow[]> =>
  (
    await db.execute<EnquiryRow>(sql`
      SELECT e.id, e.type, e.status, e.name, e.phone, e.email, e.organization, e.district, e.message, e.consent,
             e.service_category_id, sc.title AS service_category_title, e.services, e.details, e.user_id,
             e.admin_note, e.handled_by, e.created_at, e.updated_at,
             count(*) OVER ()::int AS total
      FROM enquiries e LEFT JOIN service_categories sc ON sc.id = e.service_category_id
      WHERE ${where}
      ORDER BY e.created_at DESC, e.id
      LIMIT ${limit} OFFSET ${offset}`)
  ).rows;

/** Newest first */
export const listEnquiries = (db: DbOrTx, f: EnquiryFilters, limit: number, offset: number) => select(db, whereSql(f), limit, offset);

/** With lock=true the row is locked for the rest of the transaction (FOR UPDATE can't share a statement with the window count). */
export const findEnquiry = async (db: DbOrTx, id: string, lock = false): Promise<EnquiryRow | undefined> => {
  if (lock) await db.execute(sql`SELECT 1 FROM enquiries WHERE id = ${id} FOR UPDATE`);
  return (await select(db, sql`e.id = ${id}`, 1, 0))[0];
};

export const updateEnquiryStatus = async (db: DbOrTx, id: string, status: EnquiryStatus, note: string | null, actorId: string): Promise<void> => {
  await db.execute(sql`
    UPDATE enquiries SET status = ${status}, admin_note = COALESCE(${note}, admin_note), handled_by = ${actorId}
    WHERE id = ${id}`);
};

export const countNewByType = async (db: DbOrTx): Promise<Record<EnquiryType, number>> => {
  const rows = (await db.execute<{ type: EnquiryType; n: number }>(sql`SELECT type, count(*)::int AS n FROM enquiries WHERE status = 'new' GROUP BY type`)).rows;
  const counts: Record<EnquiryType, number> = { service: 0, donation: 0, partnership: 0, contact: 0, feedback: 0 };
  for (const r of rows) counts[r.type] = r.n;
  return counts;
};

/** Every enquiry matching the filters, for the CSV export (at most 10,000, newest first) */
export const exportEnquiries = (db: DbOrTx, f: EnquiryFilters) => select(db, whereSql(f), 10_000, 0);

/** The category and the titles of the chosen services, when they are active and belong to it */
export const resolveServices = async (
  db: DbOrTx,
  categoryId: string,
  serviceIds: string[]
): Promise<{ category: { id: string; title: string } | undefined; titles: string[] }> => {
  const category = (await db.execute<{ id: string; title: string }>(sql`SELECT id, title FROM service_categories WHERE id = ${categoryId} AND is_active`)).rows[0];
  if (!category || !serviceIds.length) return { category, titles: [] };
  const titles = (
    await db.execute<{ title: string }>(sql`
      SELECT title FROM services
      WHERE category_id = ${categoryId} AND is_active AND id IN (${sql.join(serviceIds.map(id => sql`${id}::uuid`), sql`, `)})
      ORDER BY sort_order`)
  ).rows.map(r => r.title);
  return { category, titles };
};

export const findUserContact = async (db: DbOrTx, userId: string): Promise<{ full_name: string; phone: string; email: string | null } | undefined> =>
  (await db.execute<{ full_name: string; phone: string; email: string | null }>(sql`SELECT full_name, phone, email FROM users WHERE id = ${userId}`)).rows[0];
