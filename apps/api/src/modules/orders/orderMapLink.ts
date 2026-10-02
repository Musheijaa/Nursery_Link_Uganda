import { createHmac } from 'node:crypto';
import { safeEqual } from '../../lib/crypto.js';

/**
 * The nursery's order-map link (in the order SMS) carries a short key derived from the order
 * code, so the 6-character code alone can't be used to look up other people's orders.
 * 12 base64url characters = 72 bits; the purpose string keeps it distinct from other HMACs.
 */
export const orderMapKey = (secret: string, shortCode: string): string =>
  createHmac('sha256', secret).update(`order-map:${shortCode}`).digest('base64url').slice(0, 12);

export const orderMapUrl = (publicWebUrl: string, secret: string, shortCode: string): string => {
  const url = new URL(`/o/${shortCode}`, publicWebUrl);
  url.searchParams.set('k', orderMapKey(secret, shortCode));
  return url.toString();
};

export const isValidOrderMapKey = (secret: string, shortCode: string, key: string): boolean =>
  safeEqual(orderMapKey(secret, shortCode), key);
