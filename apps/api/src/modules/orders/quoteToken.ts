import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { DeliveryType, Vehicle } from '@nurserylink/shared';
import { ValidationError } from '../../lib/errors.js';
import type { LatLng } from '../../lib/geo.js';

export const QUOTE_TTL_SECONDS = 10 * 60;

/** Everything a quote promised. The order is created from this, never from client-sent totals. */
export interface QuotePayload {
  user_id: string;
  nursery_id: string;
  delivery_type: DeliveryType;
  delivery_point: LatLng | null;
  distance_km: number | null;
  vehicle: Vehicle | null;
  delivery_fee: number;
  items_total: number;
  grand_total: number;
  items: { inventory_id: string; species_id: string; quantity: number; unit_price: number }[];
}

const key = (secret: string) => new TextEncoder().encode(secret);

/** Signs a quote. Its jti becomes the collection payment's idempotency key, so a quote can place one order only. */
export const signQuote = async (secret: string, payload: QuotePayload): Promise<{ token: string; id: string; expiresAt: Date }> => {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000);
  const token = await new SignJWT({ typ: 'quote', quote: payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key(secret));
  return { token, id, expiresAt };
};

export const verifyQuote = async (secret: string, token: string): Promise<{ id: string; quote: QuotePayload }> => {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] });
    if (payload.typ !== 'quote' || typeof payload.jti !== 'string' || typeof payload.quote !== 'object' || payload.quote === null) {
      throw new Error('not a quote');
    }
    return { id: payload.jti, quote: payload.quote as QuotePayload };
  } catch {
    // Expired, tampered or foreign tokens all mean the same thing to the buyer
    throw new ValidationError('This quote has expired or is not valid. Please get a new quote.', { path: 'quote_token' });
  }
};
