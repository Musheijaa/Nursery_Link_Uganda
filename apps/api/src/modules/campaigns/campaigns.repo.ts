import { sql, type SQL } from 'drizzle-orm';
import { GIVEAWAY_CLOSING_SOON_DAYS, type EligibilityRule, type FunderType, type GiveawayOfferType, type GiveawayStatus } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import { containsPattern } from '../../lib/sqlText.js';

export type CampaignRow = {
  id: string;
  title: string;
  funder_name: string;
  funder_type: FunderType;
  purpose: string;
  offer_type: GiveawayOfferType;
  subsidised_price: number | null;
  eligibility_requirements: string | null;
  application_procedure: string | null;
  application_deadline: Date | null;
  closes_at: Date;
  contact_phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  distribution_locations: string | null;
  accepts_platform_applications: boolean;
  status: GiveawayStatus;
  sub_county_id: string | null;
  sub_county_name: string | null;
  nursery_id: string | null;
  nursery_name: string | null;
  nursery_lat: number | null;
  nursery_lng: number | null;
  allocated_stock: number;
  remaining_stock: number;
  eligibility_rules: EligibilityRule[];
  starts_at: Date;
  ends_at: Date;
  is_active: boolean;
  is_open: boolean;
  species: { species_id: string; slug: string; common_name: string; quantity: number }[];
  total: number;
};

/** When applications close: the deadline when set (never after the end date), else the end date */
export const closesAtSql = sql`LEAST(COALESCE(c.application_deadline, c.ends_at), c.ends_at)`;

/** Accepting applications on this site: switched on, within its dates, and stock left */
export const openSql = sql`(c.accepts_platform_applications AND c.is_active AND now() BETWEEN c.starts_at AND ${closesAtSql} AND c.remaining_stock > 0)`;

const closingSoon = sql.raw(`interval '${String(GIVEAWAY_CLOSING_SOON_DAYS)} days'`);
/** Open (announced or running, switched on), closing soon (within 14 days), or closed */
const statusSql = sql`CASE WHEN NOT c.is_active OR now() > ${closesAtSql} THEN 'closed'
                           WHEN ${closesAtSql} <= now() + ${closingSoon} THEN 'closing_soon'
                           ELSE 'open' END`;

const selectCampaigns = async (db: DbOrTx, where: SQL, limit: number, offset: number, order: SQL = sql`c.ends_at, c.id`): Promise<CampaignRow[]> => {
  const result = await db.execute<CampaignRow>(sql`
    SELECT c.id, c.title, c.funder_name, c.funder_type, c.purpose, c.offer_type, c.subsidised_price, c.eligibility_requirements,
           c.application_procedure, c.application_deadline, ${closesAtSql} AS closes_at, c.contact_phone, c.contact_email, c.website_url,
           c.distribution_locations, c.accepts_platform_applications, ${statusSql} AS status,
           sc.id AS sub_county_id, sc.name AS sub_county_name,
           n.id AS nursery_id, n.name AS nursery_name, ST_Y(n.location) AS nursery_lat, ST_X(n.location) AS nursery_lng,
           c.allocated_stock, c.remaining_stock, c.eligibility_rules, c.starts_at, c.ends_at, c.is_active,
           ${openSql} AS is_open,
           COALESCE((SELECT json_agg(json_build_object('species_id', s.id, 'slug', s.slug, 'common_name', s.common_name, 'quantity', ci.quantity) ORDER BY s.common_name)
                     FROM campaign_items ci JOIN species s ON s.id = ci.species_id WHERE ci.campaign_id = c.id), '[]'::json) AS species,
           count(*) OVER ()::int AS total
    FROM campaigns c
    LEFT JOIN admin_boundaries sc ON sc.id = c.sub_county_id
    LEFT JOIN nurseries n ON n.id = c.nursery_id
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}`);
  return result.rows;
};

/**
 * The public Giveaways directory. Open (the default) lists switched-on giveaways that haven't closed,
 * soonest-closing first; closing soon narrows that to the next 14 days; closed lists the rest, latest first.
 */
export const listGiveaways = (
  db: DbOrTx,
  f: { status: GiveawayStatus; subCountyId?: string | undefined; purpose?: string | undefined },
  limit: number,
  offset: number
): Promise<CampaignRow[]> => {
  const statuses = f.status === 'open' ? ['open', 'closing_soon'] : [f.status];
  const conditions: SQL[] = [sql`(${statusSql}) IN (${sql.join(statuses.map(st => sql`${st}`), sql`, `)})`];
  if (f.subCountyId) conditions.push(sql`c.sub_county_id = ${f.subCountyId}`);
  if (f.purpose) conditions.push(sql`(c.purpose ILIKE ${containsPattern(f.purpose)} OR c.title ILIKE ${containsPattern(f.purpose)})`);
  const order = f.status === 'closed' ? sql`${closesAtSql} DESC, c.id` : sql`${closesAtSql}, c.id`;
  return selectCampaigns(db, sql.join(conditions, sql` AND `), limit, offset, order);
};

export const findCampaign = async (db: DbOrTx, id: string): Promise<CampaignRow | undefined> =>
  (await selectCampaigns(db, sql`c.id = ${id}`, 1, 0))[0];

/** Every campaign, newest first, for the admin console. */
export const listAllCampaigns = (db: DbOrTx, limit: number, offset: number): Promise<CampaignRow[]> =>
  selectCampaigns(db, sql`true`, limit, offset, sql`c.starts_at DESC, c.id`);

export const countApplications = async (db: DbOrTx, campaignId: string): Promise<number> =>
  (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM campaign_applications WHERE campaign_id = ${campaignId}`)).rows[0]?.n ?? 0;

/** Returns field-level problems for references that do not exist (or are the wrong kind). */
export const checkCampaignReferences = async (
  db: DbOrTx,
  nurseryId?: string,
  subCountyId?: string,
  speciesIds?: string[]
): Promise<{ path: string; message: string }[]> => {
  const problems: { path: string; message: string }[] = [];
  if (nurseryId) {
    const found = await db.execute(sql`SELECT 1 FROM nurseries WHERE id = ${nurseryId}`);
    if (!found.rows.length) problems.push({ path: 'nursery_id', message: 'No such nursery' });
  }
  if (subCountyId) {
    const found = await db.execute(sql`SELECT 1 FROM admin_boundaries WHERE id = ${subCountyId} AND level = 'sub_county'`);
    if (!found.rows.length) problems.push({ path: 'sub_county_id', message: 'No such sub-county' });
  }
  if (speciesIds?.length) {
    const found = await db.execute<{ id: string }>(sql`SELECT id FROM species WHERE id IN (${sql.join(speciesIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    const known = new Set(found.rows.map(r => r.id));
    speciesIds.forEach((id, i) => {
      if (!known.has(id)) problems.push({ path: `items.${String(i)}.species_id`, message: 'No such species' });
    });
  }
  return problems;
};
