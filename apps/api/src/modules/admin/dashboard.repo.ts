import { sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';

/** How long a paid order may wait for the nursery before the dashboard raises it. */
export const STUCK_ESCROW_HOURS = 24;
/** Stock lines older than this are "stale" (the nursery card shows the same warning). */
export const STALE_STOCK_DAYS = 30;
/** Unrecognised SMS replies from this many days back are listed. */
export const SMS_WINDOW_DAYS = 7;
const TOP = 5;

const count = async (db: DbOrTx, query: ReturnType<typeof sql>): Promise<number> =>
  (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM (${query}) q`)).rows[0]?.n ?? 0;

const orderList = (where: ReturnType<typeof sql>) => sql`
  SELECT o.id, o.short_code, o.status, o.grand_total, n.name AS nursery_name, u.full_name AS buyer_name, o.paid_at, o.updated_at
  FROM orders o JOIN nurseries n ON n.id = o.nursery_id JOIN users u ON u.id = o.user_id
  WHERE ${where}`;

export type DashboardOrder = { id: string; short_code: string; status: string; grand_total: number; nursery_name: string; buyer_name: string; paid_at: Date | null; updated_at: Date };

// The latest attempt for each order and payout kind, so retried payouts aren't counted twice
const latestFailedPayouts = sql`
  SELECT DISTINCT ON (p.order_id, p.kind) p.id, p.order_id, p.kind, p.amount, p.msisdn, p.status, p.updated_at, o.short_code,
         (SELECT count(*) FROM payments q WHERE q.order_id = p.order_id AND q.kind = p.kind)::int AS attempts
  FROM payments p JOIN orders o ON o.id = p.order_id
  WHERE p.kind <> 'collection'
  ORDER BY p.order_id, p.kind, p.created_at DESC`;

export const dashboard = async (db: DbOrTx) => {
  // New orders: paid (or confirmed in trial mode) and waiting for the nursery to dispatch
  const toDispatch = orderList(sql`o.status = 'escrow_held'`);
  const disputed = orderList(sql`o.status = 'disputed'`);
  const stuck = orderList(sql`o.status = 'escrow_held' AND o.paid_at < now() - make_interval(hours => ${STUCK_ESCROW_HOURS})`);
  // Select the DTO columns only (the inner query carries status for the filter)
  const failed = sql`SELECT l.id, l.order_id, l.kind, l.amount, l.msisdn, l.short_code, l.attempts, l.updated_at FROM (${latestFailedPayouts}) l WHERE l.status = 'failed'`;
  const stale = sql`
    SELECT n.id, n.name, s.stock_updated_at FROM nurseries n
    JOIN LATERAL (SELECT max(i.updated_at) AS stock_updated_at FROM inventory i WHERE i.nursery_id = n.id) s ON true
    WHERE n.is_active AND NOT n.is_demo AND (s.stock_updated_at IS NULL OR s.stock_updated_at < now() - make_interval(days => ${STALE_STOCK_DAYS}))`;
  const pending = sql`
    SELECT a.id, a.campaign_id, c.title AS campaign_title, u.full_name AS applicant_name, a.quantity_requested, a.created_at
    FROM campaign_applications a JOIN campaigns c ON c.id = a.campaign_id JOIN users u ON u.id = a.user_id
    WHERE a.status = 'pending'`;
  // Imported from a list (e.g. the 2018 certified nurseries) and not yet checked and switched on
  const toVerify = sql`
    SELECT n.id, n.name, d.name AS district_name, n.created_at FROM nurseries n JOIN admin_boundaries d ON d.id = n.district_id
    WHERE NOT n.is_active AND n.listing_note IS NOT NULL`;
  const sms = sql`
    SELECT id::text, after->>'from' AS sender, after->>'text' AS text, after->>'reason' AS reason, created_at
    FROM audit_log WHERE action = 'sms.unrecognised' AND created_at > now() - make_interval(days => ${SMS_WINDOW_DAYS})`;

  const [disputedN, stuckN, failedN, staleN, pendingN, smsN, verifyN, toDispatchN] = await Promise.all([disputed, stuck, failed, stale, pending, sms, toVerify, toDispatch].map(q => count(db, q)));
  const top = async <T extends Record<string, unknown>>(q: ReturnType<typeof sql>, order: ReturnType<typeof sql>) =>
    (await db.execute<T>(sql`SELECT * FROM (${q}) q ORDER BY ${order} LIMIT ${TOP}`)).rows;

  return {
    orders_to_dispatch: { count: toDispatchN, items: await top<DashboardOrder>(toDispatch, sql`q.paid_at DESC NULLS LAST`) },
    disputed_orders: { count: disputedN, items: await top<DashboardOrder>(disputed, sql`q.updated_at DESC`) },
    stuck_escrow: { count: stuckN, items: await top<DashboardOrder>(stuck, sql`q.paid_at`) },
    failed_payouts: {
      count: failedN,
      items: await top<{ id: string; order_id: string; kind: string; amount: number; msisdn: string; short_code: string; attempts: number; updated_at: Date }>(failed, sql`q.updated_at DESC`),
    },
    stale_stock: { count: staleN, items: await top<{ id: string; name: string; stock_updated_at: Date | null }>(stale, sql`q.stock_updated_at NULLS FIRST`) },
    pending_applications: {
      count: pendingN,
      items: await top<{ id: string; campaign_id: string; campaign_title: string; applicant_name: string; quantity_requested: number; created_at: Date }>(pending, sql`q.created_at`),
    },
    nurseries_to_verify: { count: verifyN, items: await top<{ id: string; name: string; district_name: string; created_at: Date }>(toVerify, sql`q.name`) },
    unparsed_sms: { count: smsN, items: await top<{ id: string; sender: string | null; text: string | null; reason: string | null; created_at: Date }>(sms, sql`q.created_at DESC`) },
  };
};
