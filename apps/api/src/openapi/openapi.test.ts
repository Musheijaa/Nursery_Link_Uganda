import request from 'supertest';
import { pino } from 'pino';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../app.js';
import { createPool } from '../db/client.js';
import { RecordingQueue } from '../jobs/queue.js';
import { adminToken, bearer } from '../../test/auth.js';
import { prepareTestDatabase } from '../../test/db.js';
import { mockProviders } from '../../test/providers.js';
import { testConfig } from '../../test/testConfig.js';
import { buildOpenApiDocument, toOpenApiPath } from './document.js';
import { operations } from './operations.js';

const pool = createPool(inject('databaseUrl'));
const deps = { config: testConfig(inject('databaseUrl')), pool, logger: pino({ level: 'silent' }), providers: mockProviders(), queue: new RecordingQueue() };
const app = createApp(deps);

let admin: Record<string, string>;
beforeAll(async () => {
  await prepareTestDatabase(pool);
  admin = bearer(await adminToken(app));
});
afterAll(() => pool.end());

type Json = Record<string, unknown>;

/** Every route handler Express serves, counted by walking the router tree. */
const countRoutes = (app: Express): number => {
  type Layer = { route?: { methods: Record<string, boolean> }; handle: { stack?: Layer[] } };
  const walk = (stack: Layer[]): number =>
    stack.reduce((n, layer) => {
      if (layer.route) return n + Object.keys(layer.route.methods).filter(m => m !== '_all').length;
      return n + (layer.handle.stack ? walk(layer.handle.stack) : 0);
    }, 0);
  return walk((app as unknown as { router: { stack: Layer[] } }).router.stack);
};

/** Sample values that satisfy each path parameter's format. */
const SAMPLE: Record<string, string> = {
  id: '00000000-0000-4000-8000-000000000000',
  runId: '00000000-0000-4000-8000-000000000000',
  slug: 'mvule',
  provider: 'mock',
};

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument('1.2.3');

  it('is an OpenAPI 3.1 document with every operation', () => {
    expect(doc).toMatchObject({ openapi: '3.1.0', info: { version: '1.2.3' }, servers: [{ url: '/api/v1' }] });
    const paths = doc.paths as Record<string, Json>;
    const documented = Object.values(paths).reduce((n, item) => n + Object.keys(item).length, 0);
    expect(documented).toBe(operations.length);
  });

  it('documents exactly the routes Express serves', () => {
    // Beyond the documented operations: GET /docs/openapi.json and the two dev-only mock helpers
    expect(countRoutes(app)).toBe(operations.length + 3);
  });

  it.each(operations.map(op => [op.method.toUpperCase(), op.path, op] as const))('%s %s is routed', async (_method, path, op) => {
    const url = `/api/v1${path.replace(/:([A-Za-z]+)/g, (_m, name: string) => SAMPLE[name] ?? name)}`;
    const call = (request(app) as unknown as Record<string, (u: string) => request.Test>)[op.method];
    if (!call) throw new Error(`No supertest method ${op.method}`);
    const res = await call(url).set(admin).send({});
    // Any answer but "No such endpoint" means a real route handled it (404s for unknown records are fine)
    expect((res.body as { error?: { message?: string } }).error?.message).not.toBe('No such endpoint');
  });

  it('describes request bodies and parameters from the Zod schemas', () => {
    const paths = doc.paths as Record<string, Record<string, Json>>;
    const register = paths['/auth/register']?.post as { requestBody: { content: Record<string, { schema: Json }> } };
    const schema = register.requestBody.content['application/json']?.schema as { properties: Record<string, Json>; required: string[] };
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(['full_name', 'phone', 'password']));
    expect(schema.required).toEqual(expect.arrayContaining(['full_name', 'phone', 'password']));

    const nurseries = paths['/nurseries']?.get as { parameters: { name: string; in: string; required: boolean }[] };
    expect(nurseries.parameters.map(p => p.name)).toEqual(expect.arrayContaining(['lat', 'lng', 'sort', 'format', 'page', 'limit']));
    expect(nurseries.parameters.every(p => p.in === 'query' && !p.required)).toBe(true);

    const order = paths[toOpenApiPath('/orders/:id')]?.get as { parameters: { name: string; in: string; required: boolean; schema: Json }[]; security: unknown[] };
    expect(order.parameters).toEqual([expect.objectContaining({ name: 'id', in: 'path', required: true, schema: expect.objectContaining({ format: 'uuid' }) as unknown })]);
    expect(order.security).toEqual([{ bearerAuth: [] }]);
  });

  it('has only resolvable references and unique operation ids', () => {
    const text = JSON.stringify(doc);
    const refs = [...text.matchAll(/"\$ref":"#\/components\/schemas\/([A-Za-z]+)"/g)].map(m => m[1]);
    const schemas = (doc.components as { schemas: Json }).schemas;
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(schemas).toHaveProperty(ref ?? '');
    const ids = Object.values(doc.paths as Record<string, Record<string, { operationId: string }>>).flatMap(item => Object.values(item).map(o => o.operationId));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('GET /api/v1/docs', () => {
  it('serves the document and Swagger UI from this API (no CDN)', async () => {
    const json = await request(app).get('/api/v1/docs/openapi.json').expect(200);
    expect((json.body as Json).openapi).toBe('3.1.0');
    const html = await request(app).get('/api/v1/docs/').expect(200);
    expect(html.text).toContain('swagger-ui');
    expect(html.headers['content-security-policy']).toContain("script-src 'self'");
    expect(html.text).not.toMatch(/https?:\/\/(unpkg|cdn)/);
  });

  it('can be switched off', async () => {
    const off = createApp({ ...deps, config: testConfig(inject('databaseUrl'), { API_DOCS: 'false' }) });
    await request(off).get('/api/v1/docs/openapi.json').expect(404);
  });
});
