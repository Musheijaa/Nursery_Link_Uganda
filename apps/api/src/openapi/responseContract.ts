import type { RequestHandler } from 'express';
import { z } from 'zod';
import { operations, type Operation } from './operations.js';

const API_PREFIX = '/api/v1';

const byRoute = new Map<string, Operation>(operations.map(op => [`${op.method.toUpperCase()} ${op.path}`, op]));

const envelopeSchema = (response: NonNullable<Operation['response']>) =>
  z.strictObject({ data: response.data, ...(response.meta ? { meta: response.meta } : {}) });
const envelopes = new Map<Operation, z.ZodType>();

/**
 * Checks every successful JSON response against its operation's documented schema. Enabled in
 * tests (VALIDATE_RESPONSES=true) so the whole integration suite doubles as a contract test;
 * a mismatch becomes a 500 naming the operation and the differences.
 */
export const validateResponses: RequestHandler = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    // req.route is the matched leaf route; baseUrl is where its router is mounted
    const route = req.route as { path?: unknown } | undefined;
    if (res.statusCode < 300 && typeof route?.path === 'string') {
      const path = `${req.baseUrl}${route.path}`.replace(API_PREFIX, '');
      const op = byRoute.get(`${req.method} ${path}`);
      if (op?.response) {
        let schema = envelopes.get(op);
        if (!schema) {
          schema = envelopeSchema(op.response);
          envelopes.set(op, schema);
        }
        const result = schema.safeParse(body);
        if (!result.success) {
          // Printed so a failing test shows exactly which field broke the contract
          console.error(`Contract violation: ${req.method} ${path}\n${z.prettifyError(result.error)}`);
          res.status(500);
          return json({
            error: {
              code: 'internal_error',
              message: `Response for ${req.method} ${path} does not match its documented schema`,
              details: z.treeifyError(result.error),
            },
          });
        }
      }
    }
    return json(body);
  };
  next();
};
