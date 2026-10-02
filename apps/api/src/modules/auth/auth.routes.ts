import { Router, type CookieOptions, type Response } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  requestVerificationSchema,
  resetPasswordSchema,
  verifyPhoneSchema,
} from '@nurserylink/shared';
import type { z } from 'zod';
import { ipKeyGenerator } from 'express-rate-limit';
import type { Config } from '../../config.js';
import { requireAuth } from '../../middleware/auth.js';
import { limiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { OTP_TTL_MINUTES, type AuthService, type Session } from './auth.service.js';

export const REFRESH_COOKIE = 'nl_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

type Body<S extends z.ZodType> = z.output<S>;
const body = <S extends z.ZodType>(res: Response, _schema: S): Body<S> => (res.locals.validated as { body: Body<S> }).body;

export const authRoutes = (service: AuthService, config: Config): Router => {
  const router = Router();

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    // Web and admin are same-site (localhost ports, or subdomains in production), so Lax is enough
    // and still blocks cross-site POSTs from carrying the cookie.
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };

  const sendSession = (res: Response, session: Session, status = 200) => {
    res.cookie(REFRESH_COOKIE, session.refreshToken, { ...cookieOptions, expires: session.refreshExpiresAt });
    res.status(status).json({ data: session.tokens });
  };

  const readRefreshCookie = (cookies: unknown): string | undefined => {
    const value = (cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  };

  const limit = limiter(config.RATE_LIMIT_SCALE);
  // Generous per-IP limits (many users share one mobile-network IP); tighter per-identifier limits
  const perIp = limit({ windowMinutes: 15, limit: 100 });
  const perIdentifier = limit({
    windowMinutes: 15,
    limit: 10,
    key: req => {
      const b = req.body as Record<string, unknown> | undefined;
      const id = b?.identifier ?? b?.phone ?? b?.email;
      // Fall back to the IP, grouped by /56 for IPv6 so rotating addresses cannot bypass the limit
      return typeof id === 'string' ? `id:${id.trim().toLowerCase()}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
    },
  });

  router.post('/register', perIp, validate({ body: registerSchema }), async (_req, res) => {
    const { user, session } = await service.register(body(res, registerSchema));
    if (session) {
      // Phone verification is switched off: signed in straight away
      res.cookie(REFRESH_COOKIE, session.refreshToken, { ...cookieOptions, expires: session.refreshExpiresAt });
      res.status(201).json({ data: { user, verification: null, tokens: session.tokens } });
      return;
    }
    res.status(201).json({ data: { user, verification: { sent_to: user.phone, expires_in_minutes: OTP_TTL_MINUTES }, tokens: null } });
  });

  router.post('/verify/request', perIp, validate({ body: requestVerificationSchema }), async (_req, res) => {
    await service.requestVerification(body(res, requestVerificationSchema).phone);
    res.status(202).json({ data: { message: 'If this number is waiting for verification, a new code has been sent.' } });
  });

  router.post('/verify', perIp, perIdentifier, validate({ body: verifyPhoneSchema }), async (_req, res) => {
    const { phone, code } = body(res, verifyPhoneSchema);
    sendSession(res, await service.verifyPhone(phone, code));
  });

  router.post('/login', perIp, perIdentifier, validate({ body: loginSchema }), async (_req, res) => {
    const { identifier, password } = body(res, loginSchema);
    sendSession(res, await service.login(identifier, password));
  });

  router.post('/refresh', limit({ windowMinutes: 1, limit: 60 }), async (req, res) => {
    const token = readRefreshCookie(req.cookies);
    if (!token) throw new UnauthorizedError('Please sign in again');
    try {
      sendSession(res, await service.refresh(token));
    } catch (err) {
      // A dead refresh token should not linger in the browser
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw err;
    }
  });

  router.post('/logout', async (req, res) => {
    await service.logout(readRefreshCookie(req.cookies));
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.post('/password/forgot', perIp, perIdentifier, validate({ body: forgotPasswordSchema }), async (_req, res) => {
    await service.forgotPassword(body(res, forgotPasswordSchema));
    res.status(202).json({ data: { message: 'If an account matches, we have sent a code or a reset link.' } });
  });

  router.post('/password/reset', perIp, perIdentifier, validate({ body: resetPasswordSchema }), async (_req, res) => {
    await service.resetPassword(body(res, resetPasswordSchema));
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.json({ data: { message: 'Your password has been changed. Please sign in again.' } });
  });

  router.get('/me', requireAuth, async (req, res) => {
    // requireAuth guarantees req.user
    res.json({ data: await service.me(req.user?.id ?? '') });
  });

  return router;
};
