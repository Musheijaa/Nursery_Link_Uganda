import { sql, type SQL } from 'drizzle-orm';
import type { CertificationStatus, NurseryType } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import type { LatLng } from '../../lib/geo.js';
import { containsPattern } from '../../lib/sqlText.js';

export type AdminNurseryRow = {
  id: string;
  name: string;
  type: NurseryType;
  certification_status: CertificationStatus;
  operator_name: string;
  contact_phone: string;
  payout_phone: string;
  annual_capacity: number;
  seed_source: string | null;
  is_active: boolean;
  is_demo: boolean;
  external_ref: string | null;
  listing_note: string | null;
  district_id: string;
  district_name: string;
  sub_county_id: string;
  sub_county_name: string;
  lat: number;
  lng: number;
  stock_updated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  total: number;
};

export interface AdminNurseryFilters {
  q?: string | undefined;
  districtId?: string | undefined;
  subCountyId?: string | undefined;
  isActive?: boolean | undefined;
  isDemo?: boolean | undefined;
  toVerify?: boolean | undefined;
  certificationStatus?: CertificationStatus | undefined;
}

const select = async (db: DbOrTx, where: SQL, limit: number, offset: number): Promise<AdminNurseryRow[]> => {
  const result = await db.execute<AdminNurseryRow>(sql`
    SELECT n.id, n.name, n.type, n.certification_status, n.operator_name, n.contact_phone, n.payout_phone, n.annual_capacity,
           n.seed_source, n.is_active, n.is_demo, n.external_ref, n.listing_note, d.id AS district_id, d.name AS district_name, sc.id AS sub_county_id, sc.name AS sub_county_name,
           ST_Y(n.location) AS lat, ST_X(n.location) AS lng, n.created_at, n.updated_at,
           (SELECT max(i.updated_at) FROM inventory i WHERE i.nursery_id = n.id) AS stock_updated_at,
           count(*) OVER ()::int AS total
    FROM nurseries n
    JOIN admin_boundaries d ON d.id = n.district_id
    JOIN admin_boundaries sc ON sc.id = n.sub_county_id
    WHERE ${where}
    ORDER BY lower(n.name), n.id
    LIMIT ${limit} OFFSET ${offset}`);
  return result.rows;
};

export const listNurseries = (db: DbOrTx, f: AdminNurseryFilters, limit: number, offset: number) => {
  const conditions: SQL[] = [sql`true`];
  if (f.q) conditions.push(sql`n.name ILIKE ${containsPattern(f.q)}`);
  if (f.districtId) conditions.push(sql`n.district_id = ${f.districtId}`);
  if (f.subCountyId) conditions.push(sql`n.sub_county_id = ${f.subCountyId}`);
  if (f.isActive !== undefined) conditions.push(sql`n.is_active = ${f.isActive}`);
  if (f.certificationStatus) conditions.push(sql`n.certification_status = ${f.certificationStatus}`);
  if (f.isDemo !== undefined) conditions.push(sql`n.is_demo = ${f.isDemo}`);
  // Imported from a list and not yet checked: switched off, with a note saying what to verify
  if (f.toVerify) conditions.push(sql`NOT n.is_active AND n.listing_note IS NOT NULL`);
  return select(db, sql.join(conditions, sql` AND `), limit, offset);
};

/** With lock=true the row is locked for the rest of the transaction (use before updating). */
export const findNursery = async (db: DbOrTx, id: string, lock = false): Promise<AdminNurseryRow | undefined> => {
  // FOR UPDATE cannot be combined with the window count in `select`, so lock with its own statement
  if (lock) await db.execute(sql`SELECT 1 FROM nurseries WHERE id = ${id} FOR UPDATE`);
  return (await select(db, sql`n.id = ${id}`, 1, 0))[0];
};

export const pointSql = (p: LatLng) => sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)`;

/** The sub-county polygon containing a point, and its district. */
export const boundariesForPoint = async (db: DbOrTx, p: LatLng): Promise<{ sub_county_id: string; district_id: string } | undefined> =>
  (
    await db.execute<{ sub_county_id: string; district_id: string }>(sql`
      SELECT id AS sub_county_id, parent_id AS district_id FROM admin_boundaries
      WHERE level = 'sub_county' AND ST_Contains(geom, ${pointSql(p)}) LIMIT 1`)
  ).rows[0];

export type NurseryReferences = { inventory: number; orders: number; campaigns: number };

export const countReferences = async (db: DbOrTx, id: string): Promise<NurseryReferences> => {
  const result = await db.execute<NurseryReferences>(sql`
    SELECT (SELECT count(*) FROM inventory WHERE nursery_id = ${id})::int AS inventory,
           (SELECT count(*) FROM orders WHERE nursery_id = ${id})::int AS orders,
           (SELECT count(*) FROM campaigns WHERE nursery_id = ${id})::int AS campaigns`);
  return result.rows[0] ?? { inventory: 0, orders: 0, campaigns: 0 };
};

/** Every nursery with its full inventory, for CSV and GeoJSON exports (NFR-8.2). */
export type ExportRow = Omit<AdminNurseryRow, 'total'> & {
  inventory: { species_slug: string; common_name: string; quantity_available: number; unit_price: number }[];
};

export const exportNurseries = async (db: DbOrTx): Promise<ExportRow[]> => {
  const result = await db.execute<ExportRow>(sql`
    SELECT n.id, n.name, n.type, n.certification_status, n.operator_name, n.contact_phone, n.payout_phone, n.annual_capacity,
           n.seed_source, n.is_active, n.is_demo, n.external_ref, n.listing_note, d.id AS district_id, d.name AS district_name, sc.id AS sub_county_id, sc.name AS sub_county_name,
           ST_Y(n.location) AS lat, ST_X(n.location) AS lng, n.created_at, n.updated_at,
           COALESCE((SELECT json_agg(json_build_object('species_slug', s.slug, 'common_name', s.common_name,
                                                       'quantity_available', i.quantity_available, 'unit_price', i.unit_price) ORDER BY s.slug)
                     FROM inventory i JOIN species s ON s.id = i.species_id WHERE i.nursery_id = n.id), '[]'::json) AS inventory
    FROM nurseries n
    JOIN admin_boundaries d ON d.id = n.district_id
    JOIN admin_boundaries sc ON sc.id = n.sub_county_id
    ORDER BY lower(n.name), n.id`);
  return result.rows;
};
