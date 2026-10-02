import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ErrorEnvelope } from '@nurserylink/shared';
import { AppError, NotFoundError } from '../lib/errors.js';

const send = (res: Parameters<ErrorRequestHandler>[2], status: number, error: ErrorEnvelope['error']) => {
  res.status(status).json({ error } satisfies ErrorEnvelope);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Postgres SQLSTATE, whether thrown by pg directly or wrapped by Drizzle (DrizzleQueryError.cause). */
export const pgErrorCode = (err: unknown): string | undefined => {
  if (!isRecord(err)) return undefined;
  if (typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) return err.code;
  return pgErrorCode(err.cause);
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('No such endpoint'));
};

/** The one place that turns thrown errors into HTTP responses. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof AppError) {
    send(res, err.status, { code: err.code, message: err.message, ...(err.details === undefined ? {} : { details: err.details }) });
    return;
  }

  if (err instanceof ZodError) {
    send(res, 400, {
      code: 'validation_error',
      message: 'Some fields are missing or not valid',
      details: err.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  if (isRecord(err)) {
    // Errors from express.json()
    if (err.type === 'entity.parse.failed') {
      send(res, 400, { code: 'invalid_json', message: 'Request body is not valid JSON' });
      return;
    }
    if (err.type === 'entity.too.large') {
      send(res, 413, { code: 'payload_too_large', message: 'Request body is too large' });
      return;
    }
  }

  // Postgres constraint violations that slipped past validation
  const pgCode = pgErrorCode(err);
  if (pgCode === '23505') {
    send(res, 409, { code: 'conflict', message: 'That record already exists' });
    return;
  }
  if (pgCode === '23503') {
    send(res, 409, { code: 'conflict', message: 'This record is still referenced by other data' });
    return;
  }
  if (pgCode === '23514' || pgCode === '22P02') {
    send(res, 400, { code: 'validation_error', message: 'That value is not allowed' });
    return;
  }

  req.log.error({ err }, 'Unhandled error');
  send(res, 500, { code: 'internal_error', message: 'Something went wrong on our side. Please try again.' });
};
