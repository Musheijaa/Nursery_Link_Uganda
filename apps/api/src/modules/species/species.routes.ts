import { Router } from 'express';
import { z } from 'zod';
import { categorySlugSchema } from '@nurserylink/shared';
import { validate } from '../../middleware/validate.js';
import { paginationQuerySchema } from '../../lib/pagination.js';
import { optionalLatLngQuery } from '../../lib/geo.js';
import type { SpeciesService } from './species.service.js';

/** "fruit,timber": in any of these categories */
export const categoryListParam = z
  .string()
  .max(400)
  .transform(v => v.split(',').map(c => c.trim()).filter(Boolean))
  .pipe(z.array(categorySlugSchema).max(20));

export const listQuery = paginationQuerySchema.extend({
  category: categoryListParam.optional().describe('One category slug, or several separated by commas (any of them)'),
  letter: z.string().regex(/^[A-Za-z]$/, 'One letter A–Z').optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Not a valid species slug') });
export const nurseriesQuery = z.intersection(optionalLatLngQuery, paginationQuerySchema);

export const speciesRoutes = (service: SpeciesService): Router => {
  const router = Router();

  router.get('/', validate({ query: listQuery }), async (_req, res) => {
    const { query: q } = res.locals.validated as { query: z.output<typeof listQuery> };
    const { items, meta } = await service.list({ categories: q.category, letter: q.letter, q: q.q }, { page: q.page, limit: q.limit });
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

/** GET /tree-categories: the categories (Fruit Trees, Timber Trees…) with how many trees each has */
export const treeCategoryRoutes = (service: SpeciesService): Router => {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json({ data: await service.categories() });
  });
  return router;
};
