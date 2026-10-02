import { haversineKm, polarSamples, roundKm, type LatLng } from '../../lib/geo.js';
import type { IsochroneSamples, RouteResult, RoutingProvider } from './routing.js';

/** Roads are rarely straight: Uganda's rural roads average roughly 30% longer than the crow flies. */
export const ROAD_FACTOR = 1.3;
const AVERAGE_SPEED_KMH = 30;

/** Deterministic stand-in for OSRM: straight-line distance × 1.3, at 30 km/h. */
export class MockRouting implements RoutingProvider {
  readonly name = 'mock' as const;

  route(from: LatLng, to: LatLng): Promise<RouteResult> {
    const distanceKm = roundKm(haversineKm(from, to) * ROAD_FACTOR);
    const durationMin = Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60);
    return Promise.resolve({
      distanceKm,
      durationMin,
      geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] },
      steps: [
        { instruction: 'Head towards the nursery', road: null, distance_m: Math.round(distanceKm * 1000), duration_s: durationMin * 60 },
        { instruction: 'Arrive at the nursery', road: null, distance_m: 0, duration_s: 0 },
      ],
    });
  }

  table(from: LatLng, to: LatLng[]): Promise<(number | null)[]> {
    return Promise.resolve(to.map(point => roundKm(haversineKm(from, point) * ROAD_FACTOR)));
  }

  /** Every direction is equally reachable: rings out to km ÷ 1.3 in a straight line. */
  isochrone(origin: LatLng, kms: number[]): Promise<IsochroneSamples[]> {
    const samples = polarSamples(origin, Math.max(0, ...kms) / ROAD_FACTOR);
    return Promise.resolve(
      kms.map(km => ({ km, points: [origin, ...samples.filter(p => haversineKm(origin, p) * ROAD_FACTOR <= km)] }))
    );
  }
}
