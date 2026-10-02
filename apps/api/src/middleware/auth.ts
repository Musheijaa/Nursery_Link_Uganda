import type { RequestHandler } from 'express';
import type { Role } from '@nurserylink/shared';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // Express's documented way to extend Request
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `authenticate` when a valid access token is present */
      user?: AuthUser;
    }
  }
}

/**
 * Reads `Authorization: Bearer <token>` if present. Visitors without a token pass through;
 * a present-but-invalid token is rejected so clients learn to refresh it.
 */
export const authenticate = (accessSecret: string): RequestHandler => async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    next();
    return;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedError('Use the Authorization: Bearer <token> header');
  const claims = await verifyAccessToken(accessSecret, token);
  req.user = { id: claims.sub, role: claims.role };
  next();
};

/** Rejects requests without a signed-in user. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new UnauthorizedError();
  next();
};
