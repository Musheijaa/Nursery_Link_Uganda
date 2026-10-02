import { SignJWT, errors as joseErrors, jwtVerify } from 'jose';
import type { Role } from '@nurserylink/shared';
import { UnauthorizedError, ValidationError } from './errors.js';
import { sha256 } from './crypto.js';

const ISSUER = 'nurserylink-api';
const AUDIENCE = 'nurserylink';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const RESET_TOKEN_TTL_SECONDS = 30 * 60;

export interface AccessClaims {
  sub: string;
  role: Role;
}

const key = (secret: string) => new TextEncoder().encode(secret);

export const signAccessToken = (secret: string, claims: AccessClaims): Promise<string> =>
  new SignJWT({ role: claims.role, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${String(ACCESS_TOKEN_TTL_SECONDS)}s`)
    .sign(key(secret));

/** Verifies an access token; throws UnauthorizedError for anything invalid or expired. */
export const verifyAccessToken = async (secret: string, token: string): Promise<AccessClaims> => {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
    if (payload.typ !== 'access' || typeof payload.sub !== 'string' || (payload.role !== 'buyer' && payload.role !== 'admin')) {
      throw new UnauthorizedError('Invalid access token');
    }
    return { sub: payload.sub, role: payload.role };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) throw new UnauthorizedError('Your session has expired');
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid access token');
  }
};

/**
 * Password-reset link token. It is bound to a fingerprint of the current password hash, so it
 * stops working as soon as the password changes: single use without a token table.
 */
export const signResetToken = (secret: string, userId: string, passwordHash: string): Promise<string> =>
  new SignJWT({ typ: 'reset', pwd: sha256(passwordHash).slice(0, 16) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${String(RESET_TOKEN_TTL_SECONDS)}s`)
    .sign(key(secret));

export const verifyResetToken = async (secret: string, token: string): Promise<{ userId: string; passwordFingerprint: string }> => {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
    if (payload.typ !== 'reset' || typeof payload.sub !== 'string' || typeof payload.pwd !== 'string') throw new Error('wrong token type');
    return { userId: payload.sub, passwordFingerprint: payload.pwd };
  } catch {
    // Expired, tampered and wrong-type tokens all get the same answer
    throw new ValidationError('This reset link is invalid or has expired. Request a new one.');
  }
};

export const passwordFingerprint = (passwordHash: string): string => sha256(passwordHash).slice(0, 16);
