import { Router } from 'express';
import { z } from 'zod';
import { boundaryLevelSchema } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import { NotFoundError } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import * as repo from './boundaries.repo.js';

export const listQuery = z.object({ level: boundaryLevelSchema.optional(), parent_id: z.uuid().optional() });
export const idParams = z.object({ id: z.uuid() });

/** Boundary lists drive the cascading District → Sub-county dropdowns (FR-07). Read-only, so no service layer. */
export const boundariesRoutes = (db: Database): Router => {
  const router = Router();

  router.get('/', validate({ query: listQuery }), async (_req, res) => {
    const { query } = res.locals.validated as { query: z.output<typeof listQuery> };
    res.json({ data: await repo.listBoundaries(db, { level: query.level, parentId: query.parent_id }) });
  });

  router.get('/:id/geojson', validate({ params: idParams }), async (_req, res) => {
    const { params } = res.locals.validated as { params: z.output<typeof idParams> };
    const row = await repo.findBoundaryGeoJson(db, params.id);
    if (!row) throw new NotFoundError('Boundary not found');
    const { geometry, ...properties } = row;
    res.json({ data: { type: 'Feature', id: row.id, geometry: JSON.parse(geometry) as unknown, properties } });
  });

  return router;
};
