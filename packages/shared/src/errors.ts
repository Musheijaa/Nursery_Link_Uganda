/** Machine-readable error codes returned in `{ error: { code } }`. */
export const errorCodes = [
  'validation_error',
  'invalid_json',
  'payload_too_large',
  'unauthorized',
  'phone_not_verified',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'provider_unavailable',
  'internal_error',
] as const;

export type ErrorCode = (typeof errorCodes)[number];
