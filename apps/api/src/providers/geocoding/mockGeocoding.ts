import type { GeocodedPlace, GeocodingProvider } from './geocoding.js';

/** Mukono town, roughly; mock places are scattered within ~10 km of it. */
const CENTRE = { lat: 0.353, lng: 32.755 };

/** A stable number in [0, 1) from a string, so the same query always lands in the same spot. */
const unit = (text: string, salt: number): number => {
  let h = 2166136261 ^ salt;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
};

/**
 * Development and test stand-in for Nominatim: every query finds one invented place near Mukono,
 * clearly labelled as a test place, at a position derived from the query.
 */
export class MockGeocoding implements GeocodingProvider {
  readonly name = 'mock' as const;

  search(query: string, limit: number): Promise<GeocodedPlace[]> {
    const name = query.trim().replace(/\s+/g, ' ');
    if (!name || limit < 1) return Promise.resolve([]);
    const key = name.toLowerCase();
    return Promise.resolve([
      {
        name: name.replace(/\b\p{Ll}/gu, c => c.toUpperCase()),
        context: 'Test place (mock geocoder), Mukono, Uganda',
        kind: 'village',
        lat: Math.round((CENTRE.lat + (unit(key, 1) - 0.5) * 0.18) * 1e6) / 1e6,
        lng: Math.round((CENTRE.lng + (unit(key, 2) - 0.5) * 0.18) * 1e6) / 1e6,
      },
    ]);
  }
}
