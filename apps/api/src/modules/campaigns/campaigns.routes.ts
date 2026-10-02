import { Router } from 'express';
import { z } from 'zod';
import { campaignApplySchema } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { requireRole } from '../../middleware/requireRole.js';
import { paginationMeta, paginationQuerySchema, toOffset } from '../../lib/pagination.js';
import { validate } from '../../middleware/validate.js';
import type { Limit } from '../../middleware/rateLimit.js';
import { userOrIpKey } from '../../middleware/security.js';
import type { ApplicationsService } from './applications.service.js';
import { toCampaign } from './campaigns.dto.js';
import * as repo from './campaigns.repo.js';

export const listQuery = paginationQuerySchema.extend({
  sub_county_id: z.uuid().optional(),
  purpose: z.string().trim().min(2).max(100).optional(),
});
const idParams = z.object({ id: z.uuid() });


/** Public campaign directory (FR-16), plus buyer applications (FR-17). */
export const campaignsRoutes = (db: Database, applications: ApplicationsService, limit: Limit): Router => {
  const router = Router();
  const applyLimit = limit({ windowMinutes: 60, limit: 10, key: userOrIpKey });

  // Registered before /:id so "applications" is not read as a campaign id
  router.get('/applications/me', requireRole('buyer'), validate({ query: paginationQuerySchema }), async (req, res) => {
    const { query } = res.locals.validated as { query: z.output<typeof paginationQuerySchema> };
    if (!req.user) throw new UnauthorizedError();
    const { items, meta } = await applications.listMine(req.user.id, query);
    res.json({ data: items, meta });
  });

  router.post('/:id/apply', requireRole('buyer'), applyLimit, validate({ params: idParams, body: campaignApplySchema }), async (req, res) => {
    const { params, body } = res.locals.validated as { params: z.output<typeof idParams>; body: z.output<typeof campaignApplySchema> };
    if (!req.user) throw new UnauthorizedError();
    res.status(201).json({ data: await applications.apply(req.user.id, params.id, body) });
  });

  router.get('/', validate({ query: listQuery }), async (_req, res) => {
    const { query: q } = res.locals.validated as { query: z.output<typeof listQuery> };
    const rows = await repo.listRunningCampaigns(db, { subCountyId: q.sub_county_id, purpose: q.purpose }, q.limit, toOffset(q));
    res.json({ data: rows.map(toCampaign), meta: paginationMeta(q, rows[0]?.total ?? 0) });
  });

  router.get('/:id', validate({ params: idParams }), async (_req, res) => {
    const { params } = res.locals.validated as { params: z.output<typeof idParams> };
    const row = await repo.findCampaign(db, params.id);
    if (!row) throw new NotFoundError('Campaign not found');
    res.json({ data: toCampaign(row) });
  });

  return router;
};
