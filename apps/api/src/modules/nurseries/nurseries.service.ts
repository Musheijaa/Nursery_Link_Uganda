import type { Logger } from 'pino';
import type { InventoryItemDto, NurseryProfileDto, NurserySummaryDto, PaginationMeta } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import type { RoutingProvider } from '../../providers/routing/routing.js';
import { NotFoundError, ProviderUnavailableError } from '../../lib/errors.js';
import { roundKm, type FeatureCollection, type GeoJsonLineString, type GeoJsonPoint, type LatLng } from '../../lib/geo.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import type { RouteStep } from '../../providers/routing/routing.js';
import type { SearchService } from '../search/search.service.js';
import * as repo from './nurseries.repo.js';

/** Nearest-first ranking prefilters this many candidates by straight line before asking for road distances. */
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
  certification_status: row.certification_status,
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
  species: { id: row.species_id, slug: row.slug, common_name: row.common_name, scientific_name: row.scientific_name, category: row.category },
  quantity_available: row.quantity_available,
  unit_price: row.unit_price,
  updated_at: new Date(row.updated_at).toISOString(),
});

export class NurseriesService {
  constructor(private readonly deps: { db: Database; routing: RoutingProvider; search: SearchService; logger: Logger }) {}

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
   * Nearest-first: take the 20 closest by straight line (KNN on the GiST index), then rank those
   * by road distance. If routing is unavailable, fall back to straight-line order.
   */
  private async nearest(query: ListQuery, point: LatLng): Promise<ListResult> {
    const rows = await repo.listNurseries(this.deps.db, query.filters, { point, order: 'knn', limit: NEAREST_CANDIDATES, offset: 0 });
    let items = rows.map(toSummary);
    let mode: DistanceMode = 'road';

    try {
      const roadKm = await this.deps.routing.table(point, items.map(i => i.location));
      items = items
        .map((item, i) => ({ ...item, road_km: roadKm[i] ?? null }))
        // Unreachable by road goes last; ties broken by straight line
        .sort((a, b) => (a.road_km ?? Infinity) - (b.road_km ?? Infinity) || (a.straight_km ?? 0) - (b.straight_km ?? 0));
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError)) throw err;
      this.deps.logger.warn({ err }, 'Routing unavailable; ranking nurseries by straight-line distance');
      mode = 'straight_line';
    }

    // Nearest results are a single ranked page of at most 20
    const limited = items.slice(0, query.limit);
    return { items: limited, meta: { page: 1, limit: query.limit, total: items.length, distance_mode: mode } };
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

    const [inventory, campaigns] = await Promise.all([repo.listInventory(db, [id]), repo.listActiveCampaigns(db, id)]);
    const summary = toSummary(row);
    const profile: NurseryProfile = {
      ...summary,
      inventory: inventory.map(toInventoryItem),
      stock_categories: [...new Set(inventory.filter(i => i.quantity_available > 0).map(i => i.category))].sort(),
      active_campaigns: campaigns.map(c => ({ ...c, ends_at: new Date(c.ends_at).toISOString() })),
    };

    if (point) {
      try {
        const [roadKm] = await this.deps.routing.table(point, [summary.location]);
        if (roadKm !== null && roadKm !== undefined) return { ...profile, distance_km: roadKm, distance_mode: 'road' };
      } catch (err) {
        if (!(err instanceof ProviderUnavailableError)) throw err;
        this.deps.logger.warn({ err }, 'Routing unavailable; using straight-line distance for nursery profile');
      }
      return { ...profile, distance_km: summary.straight_km ?? 0, distance_mode: 'straight_line' };
    }
    return profile;
  }

  /** Turn-by-turn route from the buyer to the nursery (FR-11). Routing failures surface as 503. */
  async route(id: string, from: LatLng): Promise<{
    nursery: { id: string; name: string; location: LatLng };
    distance_km: number;
    duration_min: number;
    geometry: GeoJsonLineString;
    steps: RouteStep[];
  }> {
    const row = await repo.findNursery(this.deps.db, id);
    if (!row) throw new NotFoundError('Nursery not found');
    const to = { lat: row.lat, lng: row.lng };
    const route = await this.deps.routing.route(from, to);
    return {
      nursery: { id: row.id, name: row.name, location: to },
      distance_km: route.distanceKm,
      duration_min: route.durationMin,
      geometry: route.geometry,
      steps: route.steps,
    };
  }
}
