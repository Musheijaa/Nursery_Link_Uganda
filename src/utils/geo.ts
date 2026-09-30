const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle (Haversine) distance in kilometres between two [lat, lng] points. */
export const distanceKm = ([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Delivery fee in UGX: UGX 10,000 base + UGX 2,000 per km, with a UGX 15,000 minimum. */
export const deliveryFeeUGX = (km: number): number =>
  Math.max(15000, Math.round(10000 + km * 2000));
