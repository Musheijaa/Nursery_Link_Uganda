import type { Logger } from 'pino';
import type { InventoryItemDto, NurseryProfileDto, NurserySummaryDto, PaginationMeta } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import { NotFoundError } from '../../lib/errors.js';
import { roundKm, type FeatureCollection, type GeoJsonPoint, type LatLng } from '../../lib/geo.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import type { SearchService } from '../search/search.service.js';
import * as repo from './nurseries.repo.js';

/** Nearest-first returns at most this many nurseries, closest first by straight line. */
export const NEAREST_CANDIDATES = 20;

export type DistanceMode = 'road' | 'straight_line';

export type NurserySummary = NurserySummaryDto;

export type InventoryItem = InventoryItemDto;

export type NurseryProfile = NurseryProfileDto;

export interface ListQuery extends Pagination {
  filters: repo.NurseryFilters;
  point?: LatLng | undefined;
  sort: 'name' | 'nearest';
}

export interface ListResult {
  items: NurserySummary[];
  meta: PaginationMeta & { distance_mode?: DistanceMode; corrected_q?: string };
}

export const toSummary = (row: repo.NurseryRow): NurserySummary => ({
  id: row.id,
  name: row.name,
  type: row.type,
  certified: row.certification_verified_at !== null,
  certification:
    row.certification_verified_at && row.certification_body
      ? { body: row.certification_body, ref: row.certification_ref, verified_at: new Date(row.certification_verified_at).toISOString() }
      : null,
  operator_name: row.operator_name,
  // Sample nurseries carry a placeholder number that must never be shown or dialled
  contact_phone: row.is_demo ? null : row.contact_phone,
  annual_capacity: row.annual_capacity,
  seed_source: row.seed_source,
  district: { id: row.district_id, name: row.district_name },
  sub_county: { id: row.sub_county_id, name: row.sub_county_name },
  is_demo: row.is_demo,
  location: { lat: row.lat, lng: row.lng },
  has_active_campaign: row.has_active_campaign,
  total_stock: row.total_stock,
  species_count: row.species_count,
  stock_updated_at: row.stock_updated_at ? new Date(row.stock_updated_at).toISOString() : null,
  ...(row.straight_km === null ? {} : { straight_km: roundKm(row.straight_km) }),
});

export const toInventoryItem = (row: repo.InventoryRow): InventoryItem => ({
  inventory_id: row.inventory_id,
  species: { id: row.species_id, slug: row.slug, common_name: row.common_name, scientific_name: row.scientific_name, categories: row.categories },
  quantity_available: row.quantity_available,
  unit_price: row.unit_price,
  updated_at: new Date(row.updated_at).toISOString(),
});

export class NurseriesService {
  constructor(private readonly deps: { db: Database; search: SearchService; logger: Logger }) {}

  /**
   * The nursery list. When the search text matches nothing as typed, it is retried with the
   * closest tree or nursery names ("mvulle" → Mvule), and meta.corrected_q says which one.
   */
  async list(query: ListQuery): Promise<ListResult> {
    const result = await this.listAsTyped(query);
    const q = query.filters.q;
    if (result.meta.total > 0 || !q) return result;
    for (const term of await this.deps.search.corrections(q, ['species', 'nursery'])) {
      const retry = await this.listAsTyped({ ...query, filters: { ...query.filters, q: term } });
      if (retry.meta.total > 0) return { ...retry, meta: { ...retry.meta, corrected_q: term } };
    }
    return result;
  }

  private async listAsTyped(query: ListQuery): Promise<ListResult> {
    if (query.sort === 'nearest' && query.point) return this.nearest(query, query.point);

    const rows = await repo.listNurseries(this.deps.db, query.filters, {
      point: query.point,
      order: 'name',
      limit: query.limit,
      offset: toOffset(query),
    });
    return {
      items: rows.map(toSummary),
      meta: { ...paginationMeta(query, rows[0]?.total ?? (await this.countWhenPageEmpty(query))), ...(query.point ? { distance_mode: 'straight_line' as const } : {}) },
    };
  }

  /**
   * Nearest-first: the 20 closest by straight line (PostGIS KNN on the GiST index), as one ranked page.
   * Road directions are Google Maps' job (the site links to it), so no road routing is needed here.
   */
  private async nearest(query: ListQuery, point: LatLng): Promise<ListResult> {
    const rows = await repo.listNurseries(this.deps.db, query.filters, { point, order: 'knn', limit: NEAREST_CANDIDATES, offset: 0 });
    const items = rows.map(toSummary);
    return { items: items.slice(0, query.limit), meta: { page: 1, limit: query.limit, total: items.length, distance_mode: 'straight_line' } };
  }

  /** A page past the end has no rows to carry the window count, so ask for the total separately. */
  private async countWhenPageEmpty(query: ListQuery): Promise<number> {
    if (query.page === 1) return 0;
    const rows = await repo.listNurseries(this.deps.db, query.filters, { order: 'name', limit: 1, offset: 0 });
    return rows[0]?.total ?? 0;
  }

  toGeoJson(items: NurserySummary[]): FeatureCollection<GeoJsonPoint, Omit<NurserySummary, 'location'>> {
    return {
      type: 'FeatureCollection',
      features: items.map(({ location, ...properties }) => ({
        type: 'Feature',
        id: properties.id,
        geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
        properties,
      })),
    };
  }

  async profile(id: string, point?: LatLng): Promise<NurseryProfile> {
    const { db } = this.deps;
    const row = await repo.findNursery(db, id, point);
    if (!row) throw new NotFoundError('Nursery not found');

    const [inventory, campaigns, categories] = await Promise.all([
      repo.listInventory(db, [id]),
      repo.listActiveCampaigns(db, id),
      repo.listStockCategories(db, id),
    ]);
    const summary = toSummary(row);
    const profile: NurseryProfile = {
      ...summary,
      inventory: inventory.map(toInventoryItem),
      stock_categories: categories,
      active_campaigns: campaigns.map(c => ({ ...c, ends_at: new Date(c.ends_at).toISOString() })),
    };

    // Straight-line distance from the person (approx.); directions open Google Maps
    if (point) return { ...profile, distance_km: summary.straight_km ?? 0, distance_mode: 'straight_line' };
    return profile;
  }


}
