import { rateLimit } from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';
import { RateLimitedError } from '../lib/errors.js';

export interface LimitOptions {
  windowMinutes: number;
  limit: number;
  /** Defaults to the client IP */
  key?: (req: Request) => string;
}

/**
 * In-memory rate limiter. Limits are per API instance; the security-critical per-phone limits
 * (OTP sending) are enforced in the database instead, so they hold across instances.
 *
 * IP-based limits are generous on purpose: Ugandan mobile networks put many users behind one
 * carrier-grade NAT address.
 */
export type Limit = (options: LimitOptions) => RequestHandler;

/**
 * Builds limiters with every limit multiplied by `scale` (RATE_LIMIT_SCALE). Production uses 1;
 * the test configuration raises it so functional tests are not throttled, while the security
 * tests run with the real limits.
 */
export const limiter = (scale: number): Limit => ({ windowMinutes, limit: max, key }) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: Math.max(1, Math.round(max * scale)),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(key ? { keyGenerator: key } : {}),
    handler: (_req, _res, next) => {
      next(new RateLimitedError());
    },
  });
