import { z } from 'zod';
import { ProviderUnavailableError } from '../../lib/errors.js';
import { haversineKm, polarSamples, roundKm, type LatLng } from '../../lib/geo.js';
import type { IsochroneSamples, RouteResult, RouteStep, RoutingProvider } from './routing.js';

// OSRM HTTP API v1: http://project-osrm.org/docs/v5.24.0/api/

const coord = (p: LatLng) => `${String(p.lng)},${String(p.lat)}`;

const maneuverSchema = z.object({ type: z.string(), modifier: z.string().optional() });
const stepSchema = z.object({ name: z.string(), distance: z.number(), duration: z.number(), maneuver: maneuverSchema });
const routeResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  routes: z
    .array(
      z.object({
        distance: z.number(),
        duration: z.number(),
        geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number(), z.number()])) }),
        legs: z.array(z.object({ steps: z.array(stepSchema) })),
      })
    )
    .optional(),
});
const tableResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  distances: z.array(z.array(z.number().nullable())).optional(),
  /** Where each destination was snapped onto the road network, and how far away (metres) */
  destinations: z.array(z.object({ distance: z.number() })).optional(),
});

/** osrm-routed's default --max-table-size is 100 coordinates, including the source. */
const TABLE_BATCH = 99;
/** A sample more than this far from any road cannot be reached by car (e.g. out on the lake). */
const MAX_SNAP_KM = 1;

/** Plain-English instruction from an OSRM maneuver, e.g. "Turn left onto Kampala–Jinja Road". */
export const describeManeuver = (step: z.infer<typeof stepSchema>): string => {
  const { type, modifier } = step.maneuver;
  const onto = step.name ? ` onto ${step.name}` : '';
  switch (type) {
    case 'depart':
      return step.name ? `Start on ${step.name}` : 'Start';
    case 'arrive':
      return 'Arrive at the nursery';
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${step.name ? ` towards ${step.name}` : ''}`;
    case 'merge':
      return `Merge${onto}`;
    case 'fork':
      return `Keep ${modifier?.includes('left') ? 'left' : 'right'} at the fork${onto}`;
    case 'end of road':
      return `At the end of the road turn ${modifier ?? 'ahead'}${onto}`;
    default:
      if (!modifier || modifier === 'straight') return `Continue${onto}`;
      if (modifier === 'uturn') return `Make a U-turn${onto}`;
      return `Turn ${modifier}${onto}`;
  }
};

type Fetch = typeof fetch;

export class OsrmRouting implements RoutingProvider {
  readonly name = 'osrm' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: Fetch = fetch,
    private readonly timeoutMs = 5000,
    /** e.g. an identifying User-Agent, which public OSRM servers require */
    private readonly headers: Record<string, string> = {}
  ) {}

  private async get(path: string): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, { headers: this.headers, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      throw new ProviderUnavailableError('Routing service unreachable', { cause: String(err) });
    }
    const body: unknown = await res.json().catch(() => null);
    // OSRM answers 400 with a JSON code such as NoRoute or InvalidQuery
    if (!res.ok && (typeof body !== 'object' || body === null)) {
      throw new ProviderUnavailableError('Routing service error', { status: res.status });
    }
    return body;
  }

  async route(from: LatLng, to: LatLng): Promise<RouteResult> {
    const parsed = routeResponseSchema.safeParse(
      await this.get(`/route/v1/driving/${coord(from)};${coord(to)}?overview=full&geometries=geojson&steps=true`)
    );
    const route = parsed.success && parsed.data.code === 'Ok' ? parsed.data.routes?.[0] : undefined;
    if (!route) {
      throw new ProviderUnavailableError('No road route found to this nursery', parsed.success ? { code: parsed.data.code } : undefined);
    }
    const steps: RouteStep[] = route.legs.flatMap(leg => leg.steps).map(step => ({
      instruction: describeManeuver(step),
      road: step.name || null,
      distance_m: Math.round(step.distance),
      duration_s: Math.round(step.duration),
    }));
    return {
      distanceKm: roundKm(route.distance / 1000),
      durationMin: Math.round(route.duration / 60),
      geometry: route.geometry,
      steps,
    };
  }

  async table(from: LatLng, to: LatLng[]): Promise<(number | null)[]> {
    if (to.length === 0) return [];
    const coords = [from, ...to].map(coord).join(';');
    const parsed = tableResponseSchema.safeParse(await this.get(`/table/v1/driving/${coords}?sources=0&annotations=distance`));
    const row = parsed.success && parsed.data.code === 'Ok' ? parsed.data.distances?.[0] : undefined;
    if (!row) throw new ProviderUnavailableError('Routing service could not compute distances');
    // Skip index 0 (origin to itself)
    return to.map((_, i) => {
      const metres = row[i + 1];
      return metres === undefined || metres === null ? null : roundKm(metres / 1000);
    });
  }

  /**
   * Samples points on rings around the origin and measures each by road with the table service,
   * in batches that fit osrm-routed's table limit. A point counts as reachable within `km` if the
   * road distance plus the walk from the road is at most `km`; points far from any road are dropped.
   */
  async isochrone(origin: LatLng, kms: number[]): Promise<IsochroneSamples[]> {
    const maxKm = Math.max(0, ...kms);
    const samples = polarSamples(origin, maxKm);
    const reach: { point: LatLng; km: number }[] = [];
    for (let i = 0; i < samples.length; i += TABLE_BATCH) {
      const batch = samples.slice(i, i + TABLE_BATCH);
      const coords = [origin, ...batch].map(coord).join(';');
      const parsed = tableResponseSchema.safeParse(await this.get(`/table/v1/driving/${coords}?sources=0&annotations=distance`));
      const row = parsed.success && parsed.data.code === 'Ok' ? parsed.data.distances?.[0] : undefined;
      if (!row) throw new ProviderUnavailableError('Routing service could not compute service areas');
      const snaps = parsed.success ? parsed.data.destinations : undefined;
      batch.forEach((point, j) => {
        const metres = row[j + 1];
        const snapKm = (snaps?.[j + 1]?.distance ?? 0) / 1000;
        if (metres === undefined || metres === null || snapKm > MAX_SNAP_KM) return;
        // Never shorter than the straight line, whatever the snapping did
        reach.push({ point, km: Math.max(metres / 1000 + snapKm, haversineKm(origin, point)) });
      });
    }
    return kms.map(km => ({ km, points: [origin, ...reach.filter(r => r.km <= km).map(r => r.point)] }));
  }
}
