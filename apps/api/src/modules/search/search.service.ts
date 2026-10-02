import type { Logger } from 'pino';
import type { PlaceDto, SuggestionDto } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import { ProviderUnavailableError } from '../../lib/errors.js';
import type { GeocodingProvider } from '../../providers/geocoding/geocoding.js';
import * as repo from './search.repo.js';

/** Fewer than this many letters is too short to guess a spelling from. */
const MIN_CORRECTION_LENGTH = 3;
/** A correction scoring 0.9 or more would already have matched exactly, so only typos are offered. */
const MAX_CORRECTION_SCORE = 0.9;

/**
 * Typo-tolerant search over our own data (trees and their local names, nurseries, districts and
 * sub-counties), plus place search by name through the geocoder (OpenStreetMap).
 */
export class SearchService {
  constructor(private readonly deps: { db: Database; geocoding: GeocodingProvider; logger: Logger }) {}

  /** Suggestions as the person types, best first across the requested kinds. */
  async suggest(q: string, kinds: repo.SuggestionKind[], limit: number): Promise<SuggestionDto[]> {
    const { db } = this.deps;
    const [species, nurseries, places] = await Promise.all([
      kinds.includes('species') ? repo.suggestSpecies(db, q, limit) : [],
      kinds.includes('nursery') ? repo.suggestNurseries(db, q, limit) : [],
      kinds.includes('place') ? repo.suggestPlaces(db, q, limit) : [],
    ]);
    const scored: { score: number; order: number; item: SuggestionDto }[] = [
      ...species.map(r => ({
        score: r.score,
        order: 0,
        item: {
          kind: 'species' as const,
          slug: r.slug,
          label: r.common_name,
          scientific_name: r.scientific_name,
          matched: r.matched === r.common_name ? null : r.matched,
          nursery_count: r.nursery_count,
        },
      })),
      ...nurseries.map(r => ({
        score: r.score,
        order: 1,
        item: { kind: 'nursery' as const, id: r.id, label: r.name, place: `${r.sub_county_name}, ${r.district_name}` },
      })),
      ...places.map(r => ({
        score: r.score,
        order: 2,
        item: { kind: 'place' as const, id: r.id, label: r.name, level: r.level, parent_id: r.parent_id, parent_name: r.parent_name, lat: r.lat, lng: r.lng },
      })),
    ];
    // Trees first among equally good matches: they are what most people search for
    return scored.sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).map(s => s.item);
  }

  /**
   * Spellings to try when a search matched nothing as typed: the closest tree or nursery names,
   * best first ("mvulle" → ["Mvule"]). Empty for short text or when nothing is close.
   */
  async corrections(q: string, kinds: ('species' | 'nursery')[]): Promise<string[]> {
    if (q.trim().length < MIN_CORRECTION_LENGTH) return [];
    const suggestions = await Promise.all([
      kinds.includes('species') ? repo.suggestSpecies(this.deps.db, q, 3) : [],
      kinds.includes('nursery') ? repo.suggestNurseries(this.deps.db, q, 3) : [],
    ]);
    const terms = suggestions
      .flat()
      .filter(r => r.score < MAX_CORRECTION_SCORE)
      .sort((a, b) => b.score - a.score)
      // Search with the common name, which every list matches on
      .map(r => ('common_name' in r ? r.common_name : r.name));
    return [...new Set(terms)].slice(0, 3);
  }

  /**
   * Places by name: our districts and sub-counties first, then villages, landmarks and roads from
   * OpenStreetMap. If OpenStreetMap is down or busy, our own places are still returned.
   */
  async places(q: string, limit: number): Promise<{ items: PlaceDto[]; osm: 'ok' | 'unavailable' }> {
    const own = (await repo.suggestPlaces(this.deps.db, q, limit)).filter(p => p.score >= 0.5);
    let osm: 'ok' | 'unavailable' = 'ok';
    let found: PlaceDto[] = [];
    try {
      found = (await this.deps.geocoding.search(q, limit)).map(p => ({
        source: 'osm' as const,
        boundary_id: null,
        name: p.name,
        context: p.context,
        kind: p.kind,
        lat: p.lat,
        lng: p.lng,
      }));
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError)) throw err;
      this.deps.logger.warn({ err }, 'Place search unavailable; returning our own places only');
      osm = 'unavailable';
    }
    const items: PlaceDto[] = [
      ...own.map(p => ({
        source: 'boundary' as const,
        boundary_id: p.id,
        name: p.name,
        context: p.parent_name ?? 'Uganda',
        kind: p.level,
        lat: p.lat,
        lng: p.lng,
      })),
      // OpenStreetMap also knows our districts; keep ours, which match the map's outlines
      ...found.filter(f => !own.some(o => o.name.toLowerCase() === f.name.toLowerCase())),
    ];
    return { items: items.slice(0, limit), osm };
  }
}
