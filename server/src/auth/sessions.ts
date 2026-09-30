import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export type Role = 'buyer' | 'nursery_owner' | 'admin';

export interface SessionUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}

export const SESSION_COOKIE = 'nl_session';
const SESSION_DAYS = 30;

export const startSession = async (res: Response, userId: string) => {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [sha256(token), userId, expires]);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    expires,
    path: '/',
  });
};

export const endSession = async (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
};

/** Attaches req.user when a valid session cookie is present. Never rejects on its own. */
export const loadUser = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string' && token.length > 0) {
    const { rows } = await query<SessionUser>(
      `SELECT u.id, u.phone, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sha256(token)]
    );
    if (rows[0]) req.user = rows[0];
  }
  next();
};

export const requireUser = (req: Request): SessionUser => {
  if (!req.user) throw unauthorized();
  return req.user;
};

export const requireRole = (req: Request, ...roles: Role[]): SessionUser => {
  const user = requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
};
