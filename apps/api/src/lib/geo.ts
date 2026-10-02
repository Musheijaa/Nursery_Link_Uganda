import { z } from 'zod';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface Feature<G, P> {
  type: 'Feature';
  id?: string;
  geometry: G;
  properties: P;
}

export interface FeatureCollection<G, P> {
  type: 'FeatureCollection';
  features: Feature<G, P>[];
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export const haversineKm = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const roundKm = (km: number): number => Math.round(km * 100) / 100;

/** `?lat=&lng=` query parameters; both or neither. */
export const optionalLatLngQuery = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine(q => (q.lat === undefined) === (q.lng === undefined), { message: 'Provide both lat and lng, or neither', path: ['lat'] });

export const requiredLatLngQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
}

/** The point `km` from `origin` on `bearingDeg` (spherical Earth, fine at these distances). */
export const destinationPoint = (origin: LatLng, km: number, bearingDeg: number): LatLng => {
  const δ = km / EARTH_RADIUS_KM;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (origin.lat * Math.PI) / 180;
  const λ1 = (origin.lng * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
};

/**
 * Sample points on rings around an origin, for building isochrones: every `ringKm` out to
 * `maxKm`, at `bearings` evenly spaced directions. 20 km at the defaults is 40 rings × 36 = 1,440 points.
 */
export const polarSamples = (origin: LatLng, maxKm: number, ringKm = 0.5, bearings = 36): LatLng[] => {
  const points: LatLng[] = [];
  for (let r = ringKm; r <= maxKm + 1e-9; r += ringKm) {
    for (let b = 0; b < bearings; b++) points.push(destinationPoint(origin, r, (360 / bearings) * b + (r / ringKm) * 5));
  }
  return points;
};
