import { ProviderUnavailableError } from '../../lib/errors.js';
import type { LatLng } from '../../lib/geo.js';
import { OsrmRouting } from './osrm.js';
import type { DirectionsProvider, RouteResult } from './routing.js';

// The FOSSGIS public OSRM server (https://routing.openstreetmap.de/about.html), car profile on
// OpenStreetMap roads, needs no key. Its usage policy: at most one request per second, a valid
// User-Agent, no heavy use, and the OpenStreetMap credit with a "fix the map" link (the web app
// shows both under the directions). So it is used only for directions, which a person asks for one
// at a time, never for distance tables or Shadow service areas: requests are spaced ≥ 1.1 s apart,
// one that would wait over 4 s is refused (503), and routes are cached.

export interface PublicOsrmOptions {
  baseUrl: string;
  /** Identifies the app to the server operator, e.g. "NurseryLinkUganda/1.0 (https://…)" */
  userAgent: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  minIntervalMs?: number;
  maxWaitMs?: number;
  cacheTtlMs?: number;
  cacheSize?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Points rounded to ~10 m, so someone reopening directions from the same spot costs no request */
const cacheKey = (from: LatLng, to: LatLng) => [from, to].map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(';');

const isNoRoute = (err: ProviderUnavailableError) =>
  typeof err.details === 'object' && err.details !== null && 'code' in err.details && err.details.code === 'NoRoute';

export class PublicOsrmDirections implements DirectionsProvider {
  readonly name = 'osrm-public' as const;
  private readonly osrm: OsrmRouting;
  private readonly cache = new Map<string, { at: number; route: RouteResult }>();
  private nextSlot = 0;
  private readonly o: Required<Omit<PublicOsrmOptions, 'fetchImpl'>>;

  constructor(options: PublicOsrmOptions) {
    this.o = {
      timeoutMs: 8000,
      minIntervalMs: 1100,
      maxWaitMs: 4000,
      cacheTtlMs: 6 * 60 * 60_000,
      cacheSize: 1000,
      now: () => Date.now(),
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
      ...options,
    };
    this.osrm = new OsrmRouting(options.baseUrl, options.fetchImpl ?? fetch, this.o.timeoutMs, { 'User-Agent': options.userAgent });
  }

  async route(from: LatLng, to: LatLng): Promise<RouteResult> {
    const key = cacheKey(from, to);
    const hit = this.cache.get(key);
    if (hit && this.o.now() - hit.at < this.o.cacheTtlMs) return hit.route;

    const route = await this.fetchRoute(from, to);
    this.cache.delete(key);
    this.cache.set(key, { at: this.o.now(), route });
    // Map keeps insertion order, so the first key is the oldest
    if (this.cache.size > this.o.cacheSize) this.cache.delete(this.cache.keys().next().value ?? key);
    return route;
  }

  /**
   * A shared public server now and then answers with a passing error, so one more try (in its own
   * slot) is made, except when OSRM says there is no road between the points.
   */
  private async fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
    await this.waitForSlot();
    try {
      return await this.osrm.route(from, to);
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError) || isNoRoute(err)) throw err;
      await this.waitForSlot();
      return this.osrm.route(from, to);
    }
  }

  /** Reserves the next request slot, one at a time and at least minIntervalMs apart. */
  private async waitForSlot(): Promise<void> {
    const now = this.o.now();
    const start = Math.max(now, this.nextSlot);
    if (start - now > this.o.maxWaitMs) throw new ProviderUnavailableError('Directions are busy; try again in a moment');
    this.nextSlot = start + this.o.minIntervalMs;
    if (start > now) await this.o.sleep(start - now);
  }
}
