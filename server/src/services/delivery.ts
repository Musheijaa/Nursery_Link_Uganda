export type DeliveryMethod = 'Collect from nursery' | 'Boda boda' | 'Truck';

export const BODA_MAX_SEEDLINGS = 300;
export const BODA_MAX_KM = 40;
/** Road distance is typically about a third longer than the straight line. */
export const ROAD_FACTOR = 1.3;

export interface DeliveryQuote {
  method: DeliveryMethod;
  available: boolean;
  feeUGX: number;
  distanceKm: number;
  note: string;
}

/** Delivery pricing. The server is the source of truth; the site only displays these quotes. */
export const quoteDelivery = (method: DeliveryMethod, roadKm: number, seedlings: number): DeliveryQuote => {
  if (method === 'Collect from nursery') {
    return { method, available: true, feeUGX: 0, distanceKm: 0, note: 'Collect during opening hours' };
  }
  // Very short trips are still charged as a few kilometres
  const km = Math.max(3, Math.round(roadKm));
  if (method === 'Boda boda') {
    if (seedlings > BODA_MAX_SEEDLINGS) {
      return { method, available: false, feeUGX: 0, distanceKm: km, note: `Up to ${BODA_MAX_SEEDLINGS} seedlings per boda` };
    }
    if (km > BODA_MAX_KM) {
      return { method, available: false, feeUGX: 0, distanceKm: km, note: `Only within ${BODA_MAX_KM} km of the nursery` };
    }
    return { method, available: true, feeUGX: Math.max(5000, Math.round((km * 1500) / 500) * 500), distanceKm: km, note: 'Usually same or next day' };
  }
  return { method, available: true, feeUGX: Math.round((60000 + km * 2500) / 1000) * 1000, distanceKm: km, note: 'Scheduled within 2–4 days' };
};
