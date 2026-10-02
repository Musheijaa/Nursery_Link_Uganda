import type { PaginationMeta } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import { NotFoundError } from '../../lib/errors.js';
import type { LatLng } from '../../lib/geo.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import { listInventory } from '../nurseries/nurseries.repo.js';
import { toInventoryItem, type InventoryItem, type ListResult, type NurseriesService, type NurserySummary } from '../nurseries/nurseries.service.js';
import * as repo from './species.repo.js';

export class SpeciesService {
  constructor(private readonly deps: { db: Database; nurseries: NurseriesService }) {}

  async list(filters: repo.SpeciesFilters, page: Pagination): Promise<{ items: Omit<repo.SpeciesRow, 'total'>[]; meta: PaginationMeta }> {
    const rows = await repo.listSpecies(this.deps.db, filters, page.limit, toOffset(page));
    const total = rows[0]?.total ?? (page.page > 1 ? await repo.countSpecies(this.deps.db) : 0);
    return { items: rows.map(({ total: _total, ...rest }) => rest), meta: paginationMeta(page, total) };
  }

  async profile(slug: string): Promise<repo.SpeciesDetailRow> {
    const row = await repo.findSpeciesBySlug(this.deps.db, slug);
    if (!row) throw new NotFoundError('Species not found');
    return row;
  }

  /**
   * Nurseries stocking this species (FR-20), each with its stock line for the species.
   * With the buyer's location the list is ranked nearest-first by road distance.
   */
  async nurseries(slug: string, point: LatLng | undefined, page: Pagination): Promise<{
    species: { id: string; slug: string; common_name: string };
    items: (NurserySummary & { stock: InventoryItem })[];
    meta: ListResult['meta'];
  }> {
    const species = await this.profile(slug);
    const result = await this.deps.nurseries.list({
      filters: { speciesId: species.id },
      point,
      sort: point ? 'nearest' : 'name',
      ...page,
    });
    const stock = await listInventory(this.deps.db, result.items.map(n => n.id), species.id);
    const byNursery = new Map(stock.map(s => [s.nursery_id, toInventoryItem(s)]));
    return {
      species: { id: species.id, slug: species.slug, common_name: species.common_name },
      items: result.items.flatMap(n => {
        const line = byNursery.get(n.id);
        return line ? [{ ...n, stock: line }] : [];
      }),
      meta: result.meta,
    };
  }
}
