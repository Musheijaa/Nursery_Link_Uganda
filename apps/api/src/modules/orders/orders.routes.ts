import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createOrderSchema, quoteRequestSchema } from '@nurserylink/shared';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { paginationQuerySchema } from '../../lib/pagination.js';
import { UnauthorizedError } from '../../lib/errors.js';
import type { Limit } from '../../middleware/rateLimit.js';
import { userOrIpKey } from '../../middleware/security.js';
import type { OrdersService } from './orders.service.js';

const idParams = z.object({ id: z.uuid() });
export const mapParams = z.object({ code: z.string().regex(/^[A-Za-z0-9]{6}$/, 'An order code has 6 letters or numbers') });
export const mapQuery = z.object({ k: z.string().min(8).max(64) });

const viewer = (req: Request) => {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
};
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of what validate() parsed
const parsed = <T>(res: Response) => res.locals.validated as T;

/** Buyer order routes. Admins may read any order; only buyers place and confirm orders. */
export const ordersRoutes = (orders: OrdersService, limit: Limit): Router => {
  const router = Router();
  // Per account: quoting calls the routing service, ordering sends a payment prompt to a phone
  const quoteLimit = limit({ windowMinutes: 1, limit: 30, key: userOrIpKey });
  const orderLimit = limit({ windowMinutes: 1, limit: 10, key: userOrIpKey });

  router.post('/quote', requireRole('buyer'), quoteLimit, validate({ body: quoteRequestSchema }), async (req, res) => {
    const { body } = parsed<{ body: z.output<typeof quoteRequestSchema> }>(res);
    res.json({ data: await orders.quote(viewer(req).id, body) });
  });

  router.post('/', requireRole('buyer'), orderLimit, validate({ body: createOrderSchema }), async (req, res) => {
    const { body } = parsed<{ body: z.output<typeof createOrderSchema> }>(res);
    const { order, next_step } = await orders.create(viewer(req).id, body);
    res.status(201).json({ data: order, meta: { next_step } });
  });

  // The nursery's map link from the order SMS: no account, but the signed key is required
  const mapLimit = limit({ windowMinutes: 1, limit: 30 });
  router.get('/by-code/:code', mapLimit, validate({ params: mapParams, query: mapQuery }), async (_req, res) => {
    const { params, query } = parsed<{ params: z.output<typeof mapParams>; query: z.output<typeof mapQuery> }>(res);
    res.json({ data: await orders.orderMap(params.code, query.k) });
  });

  router.get('/me', requireRole('buyer', 'admin'), validate({ query: paginationQuerySchema }), async (req, res) => {
    const { query } = parsed<{ query: z.output<typeof paginationQuerySchema> }>(res);
    const { items, meta } = await orders.listMine(viewer(req).id, query);
    res.json({ data: items, meta });
  });

  router.get('/:id', requireRole('buyer', 'admin'), validate({ params: idParams }), async (req, res) => {
    res.json({ data: await orders.get(viewer(req), parsed<{ params: { id: string } }>(res).params.id) });
  });

  router.put('/:id/confirm-delivery', requireRole('buyer'), orderLimit, validate({ params: idParams }), async (req, res) => {
    res.json({ data: await orders.confirmDelivery(viewer(req).id, parsed<{ params: { id: string } }>(res).params.id) });
  });

  return router;
};
