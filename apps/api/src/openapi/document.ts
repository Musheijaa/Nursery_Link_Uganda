import { z } from 'zod';
import { errorCodes, namedResponseSchemas } from '@nurserylink/shared';
import { operations, type Access, type Operation } from './operations.js';

type Json = Record<string, unknown>;

/** JSON Schema for what a client sends (the input side of transforms and defaults). */
const inputSchema = (schema: z.ZodType): Json => {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  return rest;
};

// Named response components: registered schemas become #/components/schemas/<Name> references
const COMPONENTS = '#/components/schemas/';
const registry = z.registry<{ id: string }>();
for (const [id, schema] of Object.entries(namedResponseSchemas)) registry.add(schema, { id });

const componentSchemas = (): Record<string, Json> => {
  const { schemas } = z.toJSONSchema(registry, { uri: id => `${COMPONENTS}${id}`, io: 'output', unrepresentable: 'any' }) as { schemas: Record<string, Json> };
  return Object.fromEntries(Object.entries(schemas).map(([id, { $schema: _s, $id: _i, ...rest }]) => [id, rest]));
};

/** JSON Schema for what the API returns, with registered schemas referenced as components. */
const outputSchema = (schema: z.ZodType): Json => {
  const { $schema: _drop, $defs: _defs, ...rest } = z.toJSONSchema(schema, {
    metadata: registry,
    io: 'output',
    unrepresentable: 'any',
  });
  // Registered schemas are emitted as local $defs; point them at the shared components instead
  return JSON.parse(JSON.stringify(rest).replaceAll('"#/$defs/', `"${COMPONENTS}`)) as Json;
};

/** /nurseries/:id → /nurseries/{id} (also /shadow/:runId.geojson → /shadow/{runId}.geojson) */
export const toOpenApiPath = (path: string) => path.replace(/:([A-Za-z_]+)/g, '{$1}');

const ACCESS_TEXT: Record<Access, string> = {
  public: 'Public.',
  signed_in: 'Any signed-in account.',
  buyer: 'Buyers only.',
  buyer_or_admin: 'Buyers (their own) and admins.',
  admin: 'Admins only.',
  webhook: 'Called by the payment or SMS provider.',
};

const errorRef = (description: string) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });

/** Query-string or path parameters from a Zod object (or intersection of objects). */
const parameters = (schema: z.ZodType | undefined, where: 'query' | 'path'): Json[] => {
  if (!schema) return [];
  const json = inputSchema(schema);
  const parts = Array.isArray(json.allOf) ? (json.allOf as Json[]) : [json];
  return parts.flatMap(part => {
    const properties = (part.properties ?? {}) as Record<string, Json>;
    const required = new Set((part.required ?? []) as string[]);
    return Object.entries(properties).map(([name, prop]) => ({
      name,
      in: where,
      required: where === 'path' || (required.has(name) && prop.default === undefined),
      schema: prop,
      ...(typeof prop.description === 'string' ? { description: prop.description } : {}),
    }));
  });
};

const envelope = (response: NonNullable<Operation['response']>): Json => ({
  type: 'object',
  required: response.meta ? ['data', 'meta'] : ['data'],
  properties: { data: outputSchema(response.data), ...(response.meta ? { meta: outputSchema(response.meta) } : {}) },
  additionalProperties: false,
});

const successContent = (op: Operation) => {
  if (op.success.status === 204) return undefined;
  switch (op.success.content) {
    case 'csv':
      return { 'text/csv': { schema: { type: 'string' } } };
    case 'geojson':
      return { 'application/geo+json': { schema: op.raw ? outputSchema(op.raw) : { type: 'object' } } };
    default:
      return { 'application/json': { schema: op.response ? envelope(op.response) : { $ref: '#/components/schemas/Success' } } };
  }
};

const operationObject = (op: Operation): Json => {
  const responses: Json = {
    [String(op.success.status)]: { description: op.success.description, ...(successContent(op) ? { content: successContent(op) } : {}) },
  };
  if (op.body || op.query || op.params || op.bodyContent) responses['400'] = errorRef(op.errors?.[400] ?? 'The request is not valid');
  if (op.access !== 'public' && op.access !== 'webhook') responses['401'] = errorRef('Not signed in, or the access token has expired');
  else if (op.errors?.[401]) responses['401'] = errorRef(op.errors[401]);
  if (op.access === 'buyer' || op.access === 'admin' || op.access === 'buyer_or_admin') responses['403'] = errorRef('The account does not have this role');
  else if (op.errors?.[403]) responses['403'] = errorRef(op.errors[403]);
  if (op.params) responses['404'] = errorRef(op.errors?.[404] ?? 'Not found');
  if (op.errors?.[409]) responses['409'] = errorRef(op.errors[409]);
  responses['429'] = errorRef('Too many requests');
  if (op.errors?.[503]) responses['503'] = errorRef(op.errors[503]);

  const requestBody = op.body
    ? { required: true, content: { 'application/json': { schema: inputSchema(op.body) } } }
    : op.bodyContent
      ? { required: true, description: op.bodyContent.description, content: { [op.bodyContent.type]: { schema: op.bodyContent.schema ?? { type: 'string' } } } }
      : undefined;

  const secured = op.access !== 'public' && op.access !== 'webhook';
  return {
    operationId: `${op.method}${toOpenApiPath(op.path).replace(/[{}]/g, '').replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ''))}`,
    tags: [op.tag],
    summary: op.summary,
    description: [ACCESS_TEXT[op.access], op.description].filter(Boolean).join(' '),
    ...(secured ? { security: [{ bearerAuth: [] }] } : { security: [] }),
    parameters: [...parameters(op.params, 'path'), ...parameters(op.query, 'query')],
    ...(requestBody ? { requestBody } : {}),
    responses,
  };
};

/** The OpenAPI 3.1 document, built from the operation list and the request schemas routes validate with. */
export const buildOpenApiDocument = (version: string): Json => {
  const paths: Record<string, Json> = {};
  for (const op of operations) {
    const path = toOpenApiPath(op.path);
    paths[path] = { ...(paths[path] ?? {}), [op.method]: operationObject(op) };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Nursery Link Uganda API',
      version,
      description:
        'Marketplace and supply-gap API for Uganda\'s tree nurseries (pilot: Mukono District).\n\n' +
        '- Successful responses are `{ data, meta? }`; errors are `{ error: { code, message, details? } }`.\n' +
        '- Money is whole Uganda shillings (UGX). Coordinates are WGS 84 (EPSG:4326).\n' +
        '- Sign in with `/auth/login` or `/auth/verify`, then send `Authorization: Bearer <access_token>`. ' +
        'Access tokens last 15 minutes; `/auth/refresh` renews them using the httpOnly `nl_refresh` cookie (the admin console sends `X-Client: admin` and uses `nl_admin_refresh`, so the two apps keep separate sessions).',
    },
    servers: [{ url: '/api/v1' }],
    tags: [...new Set(operations.map(o => o.tag))].map(name => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ...componentSchemas(),
        Success: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { description: 'The result' },
            meta: { type: 'object', description: 'Pagination (page, limit, total) and other context', additionalProperties: true },
          },
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', enum: [...errorCodes] },
                message: { type: 'string', description: 'Safe to show to the user' },
                details: { description: 'Field problems or other specifics' },
              },
            },
          },
        },
      },
    },
  };
};
