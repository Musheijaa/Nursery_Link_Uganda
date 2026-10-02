import { z } from 'zod';
import { ProviderUnavailableError } from '../../lib/errors.js';
import type { GeocodedPlace, GeocodingProvider } from './geocoding.js';

// Nominatim search API: https://nominatim.org/release-docs/latest/api/Search/
// The public server's usage policy (https://operations.osmfoundation.org/policies/nominatim/) asks for
// at most one request per second, an identifying User-Agent, caching of results, and no
// search-as-you-type. Hence: one request at a time, ≥ 1 s apart, results cached for a day, and
// the web app only calls this when the person presses Search.

const resultSchema = z.array(
  z.object({
    lat: z.string(),
    lon: z.string(),
    name: z.string().optional(),
    display_name: z.string(),
    type: z.string().optional(),
    addresstype: z.string().optional(),
  })
);

type Fetch = typeof fetch;

export interface NominatimOptions {
  baseUrl: string;
  /** Identifies the app to the server operator, e.g. "NurseryLinkUganda/1.0 (ops@example.ug)" */
  userAgent: string;
  fetchImpl?: Fetch;
  timeoutMs?: number;
  /** Minimum gap between requests (the public server allows 1 per second) */
  minIntervalMs?: number;
  /** Give up rather than queue a request that would wait longer than this */
  maxWaitMs?: number;
  cacheTtlMs?: number;
  cacheSize?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class NominatimGeocoding implements GeocodingProvider {
  readonly name = 'nominatim' as const;
  private readonly cache = new Map<string, { at: number; places: GeocodedPlace[] }>();
  /** When the next request may start */
  private nextSlot = 0;
  private readonly o: Required<NominatimOptions>;

  constructor(options: NominatimOptions) {
    this.o = {
      fetchImpl: fetch,
      timeoutMs: 5000,
      minIntervalMs: 1100,
      maxWaitMs: 4000,
      cacheTtlMs: 24 * 60 * 60 * 1000,
      cacheSize: 1000,
      now: () => Date.now(),
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
      ...options,
    };
  }

  async search(query: string, limit: number): Promise<GeocodedPlace[]> {
    const q = query.trim().replace(/\s+/g, ' ');
    if (!q || limit < 1) return [];
    const key = `${q.toLowerCase()}|${String(limit)}`;
    const cached = this.cache.get(key);
    if (cached && this.o.now() - cached.at < this.o.cacheTtlMs) return cached.places;

    await this.waitForSlot();
    const places = await this.fetchPlaces(q, limit);
    this.cache.delete(key);
    this.cache.set(key, { at: this.o.now(), places });
    // Map keeps insertion order, so the first key is the oldest
    if (this.cache.size > this.o.cacheSize) this.cache.delete(this.cache.keys().next().value ?? key);
    return places;
  }

  /** Reserves the next request slot, one at a time and at least minIntervalMs apart. */
  private async waitForSlot(): Promise<void> {
    const now = this.o.now();
    const start = Math.max(now, this.nextSlot);
    if (start - now > this.o.maxWaitMs) throw new ProviderUnavailableError('Place search is busy; try again in a moment');
    this.nextSlot = start + this.o.minIntervalMs;
    if (start > now) await this.o.sleep(start - now);
  }

  private async fetchPlaces(q: string, limit: number): Promise<GeocodedPlace[]> {
    const params = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'ug', limit: String(limit), 'accept-language': 'en' });
    let res: Response;
    try {
      res = await this.o.fetchImpl(`${this.o.baseUrl.replace(/\/$/, '')}/search?${params.toString()}`, {
        headers: { 'User-Agent': this.o.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.o.timeoutMs),
      });
    } catch (err) {
      throw new ProviderUnavailableError('Place search unreachable', { cause: String(err) });
    }
    if (!res.ok) throw new ProviderUnavailableError('Place search error', { status: res.status });
    const parsed = resultSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new ProviderUnavailableError('Place search returned an unexpected response');

    return parsed.data.flatMap(r => {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
      const [first = '', ...rest] = r.display_name.split(',').map(part => part.trim());
      return [{ name: r.name || first, context: rest.join(', '), kind: r.addresstype ?? r.type ?? 'place', lat, lng }];
    });
  }
}
