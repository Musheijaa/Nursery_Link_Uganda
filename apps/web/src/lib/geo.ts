export interface LatLng {
  lat: number;
  lng: number;
}

/** Straight-line distance in km (for ordering only; the API gives road distances). */
export const haversineKm = (a: LatLng, b: LatLng): number => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
