import type { RequestHandler } from 'express';
import type { Role } from '@nurserylink/shared';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

/** 401 for visitors, 403 for signed-in users without one of the roles. */
export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.user) throw new UnauthorizedError();
  if (!roles.includes(req.user.role)) throw new ForbiddenError();
  next();
};
