import { Router } from 'express';
import { z } from 'zod';
import { speciesCategorySchema } from '@nurserylink/shared';
import { validate } from '../../middleware/validate.js';
import { paginationQuerySchema } from '../../lib/pagination.js';
import { optionalLatLngQuery } from '../../lib/geo.js';
import type { SpeciesService } from './species.service.js';

export const listQuery = paginationQuerySchema.extend({
  category: speciesCategorySchema.optional(),
  letter: z.string().regex(/^[A-Za-z]$/, 'One letter A–Z').optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Not a valid species slug') });
export const nurseriesQuery = z.intersection(optionalLatLngQuery, paginationQuerySchema);

export const speciesRoutes = (service: SpeciesService): Router => {
  const router = Router();

  router.get('/', validate({ query: listQuery }), async (_req, res) => {
    const { query: q } = res.locals.validated as { query: z.output<typeof listQuery> };
    const { items, meta } = await service.list({ category: q.category, letter: q.letter, q: q.q }, { page: q.page, limit: q.limit });
    res.json({ data: items, meta });
  });

  router.get('/:slug', validate({ params: slugParams }), async (_req, res) => {
    const { params } = res.locals.validated as { params: z.output<typeof slugParams> };
    res.json({ data: await service.profile(params.slug) });
  });

  router.get('/:slug/nurseries', validate({ params: slugParams, query: nurseriesQuery }), async (_req, res) => {
    const { params, query } = res.locals.validated as { params: z.output<typeof slugParams>; query: z.output<typeof nurseriesQuery> };
    const point = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : undefined;
    const { species, items, meta } = await service.nurseries(params.slug, point, { page: query.page, limit: query.limit });
    res.json({ data: items, meta: { ...meta, species } });
  });

  return router;
};
