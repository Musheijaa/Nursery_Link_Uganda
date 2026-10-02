import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { ValidationError } from '../lib/errors.js';

/**
 * Security headers for a JSON API: nothing may be loaded, framed or sniffed. HSTS (one year)
 * applies once served over HTTPS. The docs page relaxes the content policy for its own assets.
 */
export const apiSecurityHeaders = (): RequestHandler =>
  helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
    xFrameOptions: { action: 'deny' },
  });

/** Swagger UI needs its own scripts, styles and images (served from this API, never a CDN). */
export const docsSecurityHeaders = (): RequestHandler =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
  });

/** API responses carry personal or live data (stock, prices, orders), so they are never cached. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

export const MAX_URL_LENGTH = 2048;

/** Rejects oversized URLs (the query string is the only unbounded input not covered by body limits). */
export const limitUrlLength: RequestHandler = (req, _res, next) => {
  if (req.originalUrl.length > MAX_URL_LENGTH) throw new ValidationError(`The request URL is longer than ${String(MAX_URL_LENGTH)} characters`);
  next();
};

/** Rate-limit key: the signed-in account, else the client address (IPv6 grouped by /56). */
export const userOrIpKey = (req: Request): string => (req.user ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? '')}`);
