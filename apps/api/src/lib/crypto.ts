import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const hmacSha256 = (secret: string, value: string): string => createHmac('sha256', secret).update(value).digest('hex');

/** Constant-time comparison of two hex/ASCII strings. */
export const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Cryptographically random numeric code, e.g. an SMS one-time code. */
export const randomDigits = (length: number): string => Array.from({ length }, () => String(randomInt(0, 10))).join('');

/** 256-bit random token, URL-safe. */
export const randomToken = (): string => randomBytes(32).toString('base64url');
