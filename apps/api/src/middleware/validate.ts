import type { RequestHandler } from 'express';
import type { z } from 'zod';

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export interface Validated<B = unknown, Q = unknown, P = unknown> {
  body: B;
  query: Q;
  params: P;
}

/**
 * Validates request parts with Zod and stores the parsed values on res.locals.validated.
 * Parse failures throw ZodError, which the error handler turns into a 400.
 */
export const validate = (schemas: Schemas): RequestHandler => (req, res, next) => {
  res.locals.validated = {
    body: schemas.body ? schemas.body.parse(req.body) : undefined,
    query: schemas.query ? schemas.query.parse(req.query) : undefined,
    params: schemas.params ? schemas.params.parse(req.params) : undefined,
  } satisfies Validated;
  next();
};
