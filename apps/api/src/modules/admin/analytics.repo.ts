import { sql } from 'drizzle-orm';
import type { AnalyticsRange } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';

/**
 * Admin insights: what sold, where, how people pay, and how stock and campaigns stand.
 *
 * - Sales are paid orders (paid_at in the period) that were not refunded: the money that stayed.
 * - The order-status breakdown counts every order created in the period, by its status now.
 * - Each headline figure comes with the same figure for the period just before.
 * - Days, weeks and months are Kampala days, weeks and months (East Africa Time).
 */
const TZ = 'Africa/Kampala';
const RANGES: Record<AnalyticsRange, { interval: string; bucket: 'day' | 'week' | 'month'; step: string }> = {
  '30d': { interval: '30 days', bucket: 'day', step: '1 day' },
  '90d': { interval: '90 days', bucket: 'week', step: '1 week' },
  '12m': { interval: '12 months', bucket: 'month', step: '1 month' },
};
const TOP = 8;

type Kpi = { value: number; previous: number };

export const analytics = async (db: DbOrTx, range: AnalyticsRange) => {
  const { interval, bucket, step } = RANGES[range];
  // The period: from the start of the bucket `interval` ago (Kampala time) up to now
  const window = sql`
    SELECT date_trunc(${bucket}, (now() AT TIME ZONE ${TZ}) - ${interval}::interval) AT TIME ZONE ${TZ} AS start,
           now() AS finish`;
  const { rows: [period] } = await db.execute<{ start: Date; finish: Date; prev_start: Date }>(sql`
    SELECT w.start, w.finish, w.start - (w.finish - w.start) AS prev_start FROM (${window}) w`);
  if (!period) throw new Error('Could not compute the analytics period');
  const { start, finish, prev_start: prevStart } = period;

  // Orders that brought in money (paid, not refunded) between two instants
  const sold = (from: Date, to: Date) => sql`
    SELECT o.* FROM orders o WHERE o.paid_at >= ${from} AND o.paid_at < ${to} AND o.status <> 'refunded'`;

  const kpiRow = async (from: Date, to: Date) =>
    (
      await db.execute<{ sales: number; orders: number; seedlings: number; buyers: number; free: number }>(sql`
        SELECT
          (SELECT COALESCE(sum(grand_total), 0)::bigint::float8 FROM (${sold(from, to)}) s) AS sales,
          (SELECT count(*)::int FROM (${sold(from, to)}) s) AS orders,
          (SELECT COALESCE(sum(i.quantity), 0)::int FROM (${sold(from, to)}) s JOIN order_items i ON i.order_id = s.id) AS seedlings,
          (SELECT count(*)::int FROM users WHERE role = 'buyer' AND created_at >= ${from} AND created_at < ${to}) AS buyers,
          (SELECT COALESCE(sum(quantity_requested), 0)::int FROM campaign_applications
             WHERE status IN ('approved', 'collected') AND reviewed_at >= ${from} AND reviewed_at < ${to}) AS free`)
    ).rows[0] ?? { sales: 0, orders: 0, seedlings: 0, buyers: 0, free: 0 };

  const [now, before] = [await kpiRow(start, finish), await kpiRow(prevStart, start)];
  const kpi = (a: number, b: number): Kpi => ({ value: a, previous: b });
  const avg = (r: { sales: number; orders: number }) => (r.orders > 0 ? Math.round(r.sales / r.orders) : 0);

  const series = (
    await db.execute<{ date: string; sales_ugx: number; orders: number }>(sql`
      WITH buckets AS (
        SELECT generate_series(date_trunc(${bucket}, ${start}::timestamptz AT TIME ZONE ${TZ}),
                               date_trunc(${bucket}, ${finish}::timestamptz AT TIME ZONE ${TZ}),
                               ${step}::interval) AS b
      ),
      s AS (
        SELECT date_trunc(${bucket}, paid_at AT TIME ZONE ${TZ}) AS b, sum(grand_total)::bigint::float8 AS sales, count(*)::int AS n
        FROM (${sold(start, finish)}) o GROUP BY 1
      )
      SELECT to_char(buckets.b, 'YYYY-MM-DD') AS date, COALESCE(s.sales, 0) AS sales_ugx, COALESCE(s.n, 0) AS orders
      FROM buckets LEFT JOIN s ON s.b = buckets.b ORDER BY buckets.b`)
  ).rows;

  const orderStatus = (
    await db.execute<{ status: string; count: number }>(sql`
      SELECT status, count(*)::int AS count FROM orders WHERE created_at >= ${start} AND created_at < ${finish}
      GROUP BY status ORDER BY count DESC, status`)
  ).rows;

  const delivery = (
    await db.execute<{ type: string; count: number }>(sql`
      SELECT delivery_type AS type, count(*)::int AS count FROM (${sold(start, finish)}) o GROUP BY 1 ORDER BY count DESC, 1`)
  ).rows;

  const paymentMethods = (
    await db.execute<{ method: string; count: number; sales_ugx: number }>(sql`
      SELECT payment_method AS method, count(*)::int AS count, sum(grand_total)::bigint::float8 AS sales_ugx
      FROM (${sold(start, finish)}) o GROUP BY 1 ORDER BY count DESC, 1`)
  ).rows;

  const topSpecies = (
    await db.execute<{ species_id: string; common_name: string; seedlings: number; sales_ugx: number }>(sql`
      SELECT sp.id AS species_id, sp.common_name, sum(i.quantity)::int AS seedlings, sum(i.line_total)::bigint::float8 AS sales_ugx
      FROM (${sold(start, finish)}) o JOIN order_items i ON i.order_id = o.id JOIN species sp ON sp.id = i.species_id
      GROUP BY sp.id, sp.common_name ORDER BY seedlings DESC, sp.common_name LIMIT ${TOP}`)
  ).rows;

  const topNurseries = (
    await db.execute<{ nursery_id: string; name: string; orders: number; sales_ugx: number }>(sql`
      SELECT n.id AS nursery_id, n.name, count(*)::int AS orders, sum(o.grand_total)::bigint::float8 AS sales_ugx
      FROM (${sold(start, finish)}) o JOIN nurseries n ON n.id = o.nursery_id
      GROUP BY n.id, n.name ORDER BY sales_ugx DESC, n.name LIMIT ${TOP}`)
  ).rows;

  // Stock as it stands today, at active nurseries
  const stockByCategory = (
    await db.execute<{ category: string; seedlings: number; lines: number }>(sql`
      SELECT sp.category, sum(i.quantity_available)::int AS seedlings, count(*)::int AS lines
      FROM inventory i JOIN species sp ON sp.id = i.species_id JOIN nurseries n ON n.id = i.nursery_id
      WHERE n.is_active AND i.quantity_available > 0
      GROUP BY sp.category ORDER BY seedlings DESC, sp.category`)
  ).rows;

  // Campaigns that are switched on or ended within the period
  const campaigns = (
    await db.execute<{ id: string; title: string; allocated: number; remaining: number; applications: number }>(sql`
      SELECT c.id, c.title, c.allocated_stock AS allocated, c.remaining_stock AS remaining,
             (SELECT count(*)::int FROM campaign_applications a WHERE a.campaign_id = c.id) AS applications
      FROM campaigns c WHERE c.is_active OR c.ends_at >= ${start}
      ORDER BY c.ends_at DESC, c.title LIMIT ${TOP}`)
  ).rows;

  return {
    range,
    bucket,
    from: start,
    to: finish,
    kpis: {
      sales_ugx: kpi(now.sales, before.sales),
      orders: kpi(now.orders, before.orders),
      seedlings_sold: kpi(now.seedlings, before.seedlings),
      avg_order_ugx: kpi(avg(now), avg(before)),
      new_buyers: kpi(now.buyers, before.buyers),
      free_seedlings: kpi(now.free, before.free),
    },
    series,
    order_status: orderStatus,
    delivery,
    payment_methods: paymentMethods,
    top_species: topSpecies,
    top_nurseries: topNurseries,
    stock_by_category: stockByCategory,
    campaigns,
  };
};
