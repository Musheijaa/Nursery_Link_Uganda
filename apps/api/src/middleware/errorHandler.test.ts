import express from 'express';
import request from 'supertest';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  ConflictError, ForbiddenError, NotFoundError, ProviderUnavailableError, RateLimitedError, UnauthorizedError, ValidationError,
} from '../lib/errors.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import { validate } from './validate.js';
import { errorOf } from '../../test/http.js';

const appThrowing = (error: unknown) => {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  app.use(express.json({ limit: '1kb' }));
  app.get('/boom', () => {
    throw error;
  });
  app.post('/echo', validate({ body: z.object({ name: z.string().min(2) }) }), (_req, res) => {
    res.json({ data: res.locals.validated as unknown });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

describe('errorHandler', () => {
  it.each([
    [new ValidationError('Bad input', { field: 'x' }), 400, 'validation_error'],
    [new UnauthorizedError(), 401, 'unauthorized'],
    [new ForbiddenError(), 403, 'forbidden'],
    [new NotFoundError(), 404, 'not_found'],
    [new ConflictError('Stock changed'), 409, 'conflict'],
    [new RateLimitedError(), 429, 'rate_limited'],
    [new ProviderUnavailableError('MoMo is down'), 503, 'provider_unavailable'],
  ])('maps %s to %i', async (error, status, code) => {
    const res = await request(appThrowing(error)).get('/boom').expect(status);
    expect(errorOf(res).code).toBe(code);
    expect(errorOf(res).message).toBe(error.message);
  });

  it('includes details only when present', async () => {
    const res = await request(appThrowing(new ValidationError('Bad input', { field: 'x' }))).get('/boom');
    expect(errorOf(res).details).toEqual({ field: 'x' });
    const bare = await request(appThrowing(new NotFoundError())).get('/boom');
    expect(errorOf(bare)).not.toHaveProperty('details');
  });

  it('turns Zod failures into a 400 with field paths', async () => {
    const res = await request(appThrowing(null)).post('/echo').send({ name: 'x' }).expect(400);
    const error = errorOf(res);
    expect(error.code).toBe('validation_error');
    expect(error.details).toHaveLength(1);
    expect((error.details as { path: string }[])[0]?.path).toBe('name');
  });

  it('handles malformed and oversized JSON', async () => {
    const bad = await request(appThrowing(null)).post('/echo').set('content-type', 'application/json').send('{"name":').expect(400);
    expect(errorOf(bad).code).toBe('invalid_json');
    const big = await request(appThrowing(null)).post('/echo').send({ name: 'x'.repeat(2000) }).expect(413);
    expect(errorOf(big).code).toBe('payload_too_large');
  });

  it('maps Postgres constraint errors, including ones wrapped by Drizzle', async () => {
    const wrapped = (code: string) => Object.assign(new Error('Failed query'), { cause: Object.assign(new Error('pg'), { code }) });
    expect(errorOf(await request(appThrowing(wrapped('23505'))).get('/boom').expect(409)).code).toBe('conflict');
    expect(errorOf(await request(appThrowing(wrapped('23503'))).get('/boom').expect(409)).code).toBe('conflict');
    expect(errorOf(await request(appThrowing(Object.assign(new Error('x'), { code: '23514' }))).get('/boom').expect(400)).code).toBe('validation_error');
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const res = await request(appThrowing(new Error('database password is hunter2'))).get('/boom').expect(500);
    expect(errorOf(res).code).toBe('internal_error');
    expect(errorOf(res).message).not.toContain('hunter2');
  });

  it('returns 404 in the envelope for unknown routes', async () => {
    const res = await request(appThrowing(null)).get('/nope').expect(404);
    expect(errorOf(res).code).toBe('not_found');
  });
});
