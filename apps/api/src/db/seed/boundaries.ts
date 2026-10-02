/**
 * Placeholder administrative boundaries for the Mukono District pilot.
 *
 * TODO(boundaries): replace these approximations with the official polygons before production.
 *   - UBOS (Uganda Bureau of Statistics) administrative boundaries, 2019 or later, district and sub-county
 *     levels, available via the UBOS GIS unit / Humanitarian Data Exchange ("cod-ab-uga"); or
 *   - OpenStreetMap boundary relations for Mukono District (boundary=administrative) and its sub-counties.
 *   Load them into admin_boundaries (geom as MultiPolygon, SRID 4326) keeping the same names so FKs survive.
 *
 * Until then the district is a hand-drawn outline of Mukono's mainland plus the Koome islands, and each
 * sub-county/division is the Voronoi cell of an approximate centre point, clipped to that outline. Good
 * enough for filters, nearest-nursery tests and map demos; NOT accurate enough for official reporting.
 */

export const DISTRICT_NAME = 'Mukono';

/** Approximate mainland outline, [lng, lat], clockwise from the south-west (Lake Victoria shore). */
export const MUKONO_MAINLAND: [number, number][] = [
  [32.62, 0.25],
  [32.63, 0.45],
  [32.68, 0.62],
  [32.78, 0.72],
  [32.92, 0.7],
  [32.97, 0.55],
  [32.96, 0.35],
  [32.9, 0.2],
  [32.83, 0.15],
  [32.72, 0.17],
  [32.65, 0.21],
  [32.62, 0.25],
];

/** Approximate extent of the Koome island group in Lake Victoria. */
export const KOOME_ISLANDS: [number, number][] = [
  [32.76, 0.02],
  [32.76, 0.1],
  [32.9, 0.1],
  [32.9, 0.02],
  [32.76, 0.02],
];

/**
 * Sub-counties and municipal divisions with approximate centre points [lng, lat].
 * Positions are indicative only; see the TODO above.
 */
export const SUB_COUNTIES: { name: string; centre: [number, number] }[] = [
  { name: 'Mukono Central Division', centre: [32.755, 0.353] },
  { name: 'Goma Division', centre: [32.67, 0.37] },
  { name: 'Nama', centre: [32.73, 0.43] },
  { name: 'Nakisunga', centre: [32.84, 0.33] },
  { name: 'Kyampisi', centre: [32.7, 0.27] },
  { name: 'Ntenjeru', centre: [32.79, 0.21] },
  { name: 'Mpatta', centre: [32.88, 0.19] },
  { name: 'Mpunge', centre: [32.92, 0.27] },
  { name: 'Koome', centre: [32.83, 0.06] },
  { name: 'Seeta-Namuganga', centre: [32.84, 0.47] },
  { name: 'Nabbaale', centre: [32.66, 0.5] },
  { name: 'Kimenyedde', centre: [32.74, 0.57] },
  { name: 'Nagojje', centre: [32.92, 0.52] },
  { name: 'Kasawo', centre: [32.8, 0.65] },
  { name: 'Ntunda', centre: [32.88, 0.64] },
];

export const ringToWkt = (ring: [number, number][]) => `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`;
