import { sql, type SQL } from 'drizzle-orm';
import type { ApplicationStatus, EligibilityRule } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import type { Answers } from '@nurserylink/shared';

export type CampaignForApply = {
  id: string;
  title: string;
  nursery_name: string;
  remaining_stock: number;
  eligibility_rules: EligibilityRule[];
  is_open: boolean;
};

/** With lock=true the campaign row is locked, so stock checks and changes cannot interleave. */
export const campaignForApply = async (db: DbOrTx, id: string, lock = false): Promise<CampaignForApply | undefined> => {
  if (lock) await db.execute(sql`SELECT 1 FROM campaigns WHERE id = ${id} FOR UPDATE`);
  return (
    await db.execute<CampaignForApply>(sql`
      SELECT c.id, c.title, n.name AS nursery_name, c.remaining_stock, c.eligibility_rules,
             (c.is_active AND now() BETWEEN c.starts_at AND c.ends_at AND c.remaining_stock > 0) AS is_open
      FROM campaigns c JOIN nurseries n ON n.id = c.nursery_id
      WHERE c.id = ${id}`)
  ).rows[0];
};

export const insertApplication = async (
  db: DbOrTx,
  a: { campaignId: string; userId: string; answers: Answers; quantityRequested: number }
): Promise<string> => {
  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO campaign_applications (campaign_id, user_id, answers, quantity_requested)
    VALUES (${a.campaignId}, ${a.userId}, ${JSON.stringify(a.answers)}::jsonb, ${a.quantityRequested})
    RETURNING id`);
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Application insert returned no row');
  return id;
};

export const decrementCampaignStock = async (db: DbOrTx, campaignId: string, quantity: number): Promise<void> => {
  await db.execute(sql`UPDATE campaigns SET remaining_stock = remaining_stock - ${quantity} WHERE id = ${campaignId}`);
};

export const setApplicationStatus = async (db: DbOrTx, id: string, status: ApplicationStatus, reviewerId: string): Promise<void> => {
  await db.execute(sql`UPDATE campaign_applications SET status = ${status}, reviewed_by = ${reviewerId}, reviewed_at = now() WHERE id = ${id}`);
};

export type ApplicationRow = {
  id: string;
  campaign_id: string;
  campaign_title: string;
  pickup_nursery: string;
  user_id: string;
  applicant_name: string;
  applicant_phone: string;
  answers: Answers;
  quantity_requested: number;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  total: number;
};

const selectApplications = async (db: DbOrTx, where: SQL, limit: number, offset: number): Promise<ApplicationRow[]> =>
  (
    await db.execute<ApplicationRow>(sql`
      SELECT a.id, a.campaign_id, c.title AS campaign_title, n.name AS pickup_nursery,
             a.user_id, u.full_name AS applicant_name, u.phone AS applicant_phone,
             a.answers, a.quantity_requested, a.status, a.reviewed_by, a.reviewed_at, a.created_at,
             count(*) OVER ()::int AS total
      FROM campaign_applications a
      JOIN campaigns c ON c.id = a.campaign_id
      JOIN nurseries n ON n.id = c.nursery_id
      JOIN users u ON u.id = a.user_id
      WHERE ${where}
      ORDER BY a.created_at DESC, a.id
      LIMIT ${limit} OFFSET ${offset}`)
  ).rows;

export const findApplication = async (db: DbOrTx, id: string, lock = false): Promise<ApplicationRow | undefined> => {
  if (lock) await db.execute(sql`SELECT 1 FROM campaign_applications WHERE id = ${id} FOR UPDATE`);
  return (await selectApplications(db, sql`a.id = ${id}`, 1, 0))[0];
};

export const listForCampaign = (db: DbOrTx, campaignId: string, status: ApplicationStatus | undefined, limit: number, offset: number) =>
  selectApplications(db, status ? sql`a.campaign_id = ${campaignId} AND a.status = ${status}` : sql`a.campaign_id = ${campaignId}`, limit, offset);

export const listForUser = (db: DbOrTx, userId: string, limit: number, offset: number) => selectApplications(db, sql`a.user_id = ${userId}`, limit, offset);

export const campaignExists = async (db: DbOrTx, id: string): Promise<boolean> =>
  (await db.execute(sql`SELECT 1 FROM campaigns WHERE id = ${id}`)).rows.length > 0;
