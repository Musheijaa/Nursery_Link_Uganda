import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);
export const unauthorized = (message = 'Please sign in to continue') => new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'You do not have access to this') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'Not found') => new HttpError(404, message, 'not_found');
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('No such API endpoint'));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    res.status(400).json({
      error: { message: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input', code: 'validation_error', issues: err.issues },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code } });
    return;
  }
  // Postgres check/unique violations that slipped past validation
  if (err?.code === '23505') {
    res.status(409).json({ error: { message: 'That record already exists', code: 'duplicate' } });
    return;
  }
  if (err?.code === '23514') {
    res.status(400).json({ error: { message: 'That value is not allowed', code: 'constraint_violation' } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Request body is not valid JSON', code: 'invalid_json' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again.', code: 'internal' } });
};
