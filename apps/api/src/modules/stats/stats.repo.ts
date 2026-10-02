import { sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';

/**
 * The marketplace at a glance, for the home page: active nurseries, the kinds of trees they have in
 * stock, how many seedlings that adds up to, the sub-counties they cover, and campaigns open now
 * (switched on, within their dates, with seedlings left: the same rule as the campaign list).
 */
export const publicStats = async (db: DbOrTx) => {
  const { rows: [row] } = await db.execute<{ nurseries: number; species_in_stock: number; seedlings_in_stock: number; sub_counties: number; open_campaigns: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM nurseries WHERE is_active) AS nurseries,
      (SELECT count(DISTINCT i.species_id)::int FROM inventory i JOIN nurseries n ON n.id = i.nursery_id
         WHERE n.is_active AND i.quantity_available > 0) AS species_in_stock,
      (SELECT COALESCE(sum(i.quantity_available), 0)::bigint::float8 FROM inventory i JOIN nurseries n ON n.id = i.nursery_id
         WHERE n.is_active AND i.quantity_available > 0) AS seedlings_in_stock,
      (SELECT count(DISTINCT sub_county_id)::int FROM nurseries WHERE is_active) AS sub_counties,
      (SELECT count(*)::int FROM campaigns
         WHERE is_active AND starts_at <= now() AND ends_at > now() AND remaining_stock > 0) AS open_campaigns`);
  return row ?? { nurseries: 0, species_in_stock: 0, seedlings_in_stock: 0, sub_counties: 0, open_campaigns: 0 };
};
