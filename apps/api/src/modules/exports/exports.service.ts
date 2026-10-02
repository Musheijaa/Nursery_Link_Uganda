import type { Database } from '../../db/client.js';
import type { FeatureCollection, GeoJsonPoint } from '../../lib/geo.js';
import { exportNurseries, type ExportRow } from '../nurseries/nurseries.admin.repo.js';

/**
 * Spreadsheet apps execute cells starting with = + - @ (and tab/CR) as formulas; prefix them
 * so an exported value can never run as a formula (CSV injection).
 */
const stringify = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
  return JSON.stringify(value);
};

export const csvCell = (value: unknown): string => {
  let text = stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (header: string[], rows: unknown[][]): string =>
  [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

// Payout numbers are deliberately left out: exports are for partners and reporting (NFR-8.1/8.2)
const publicFields = (n: ExportRow) => ({
  id: n.id,
  name: n.name,
  type: n.type,
  certification_status: n.certification_status,
  is_active: n.is_active,
  district: n.district_name,
  sub_county: n.sub_county_name,
  operator_name: n.operator_name,
  contact_phone: n.contact_phone,
  annual_capacity: n.annual_capacity,
  seed_source: n.seed_source,
  total_stock: n.inventory.reduce((sum, i) => sum + i.quantity_available, 0),
  updated_at: new Date(n.updated_at).toISOString(),
});

export class ExportsService {
  constructor(private readonly deps: { db: Database }) {}

  async nurseriesCsv(): Promise<string> {
    const rows = await exportNurseries(this.deps.db);
    const header = [
      'id', 'name', 'type', 'certification_status', 'is_active', 'district', 'sub_county', 'latitude', 'longitude',
      'operator_name', 'contact_phone', 'annual_capacity', 'seed_source', 'total_stock', 'stock', 'updated_at',
    ];
    return toCsv(
      header,
      rows.map(n => {
        const p = publicFields(n);
        // e.g. "mvule:2500@2000; musizi:5000@800" (species:quantity@price)
        const stock = n.inventory.map(i => `${i.species_slug}:${String(i.quantity_available)}@${String(i.unit_price)}`).join('; ');
        return [p.id, p.name, p.type, p.certification_status, p.is_active, p.district, p.sub_county, n.lat, n.lng,
          p.operator_name, p.contact_phone, p.annual_capacity, p.seed_source, p.total_stock, stock, p.updated_at];
      })
    );
  }

  async nurseriesGeoJson(): Promise<FeatureCollection<GeoJsonPoint, ReturnType<typeof publicFields> & { inventory: ExportRow['inventory'] }>> {
    const rows = await exportNurseries(this.deps.db);
    return {
      type: 'FeatureCollection',
      features: rows.map(n => ({
        type: 'Feature',
        id: n.id,
        geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
        properties: { ...publicFields(n), inventory: n.inventory },
      })),
    };
  }
}
