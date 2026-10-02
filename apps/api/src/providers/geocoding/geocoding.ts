/** A place found by name: a village, trading centre, landmark or road. */
export interface GeocodedPlace {
  /** The place's own name, e.g. "Seeta" */
  name: string;
  /** Where it is, for telling places apart, e.g. "Goma Division, Mukono, Uganda" */
  context: string;
  /** What kind of place it is, e.g. "village", "school", "road" */
  kind: string;
  lat: number;
  lng: number;
}

/**
 * Place search by name (forward geocoding), limited to Uganda.
 * Implementations: Nominatim (OpenStreetMap) and MockGeocoding.
 */
export interface GeocodingProvider {
  readonly name: 'mock' | 'nominatim';
  /** Throws ProviderUnavailableError when the service cannot be reached. */
  search(query: string, limit: number): Promise<GeocodedPlace[]>;
}
