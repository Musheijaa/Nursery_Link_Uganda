import { Router } from 'express';
import { z } from 'zod';
import { newsCategorySchema } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import { NotFoundError } from '../../lib/errors.js';
import { paginationMeta, paginationQuerySchema, toOffset } from '../../lib/pagination.js';
import { validate } from '../../middleware/validate.js';
import * as repo from './news.repo.js';

export const listQuery = paginationQuerySchema.extend({ category: newsCategorySchema.optional() });
export const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Not a valid slug') });

const iso = (d: Date) => new Date(d).toISOString();

/** News feed (FR-22). Read-only, so no service layer. */
export const newsRoutes = (db: Database): Router => {
  const router = Router();

  router.get('/', validate({ query: listQuery }), async (_req, res) => {
    const { query: q } = res.locals.validated as { query: z.output<typeof listQuery> };
    const rows = await repo.listNews(db, q.category, q.limit, toOffset(q));
    res.json({
      data: rows.map(({ total: _total, published_at, ...rest }) => ({ ...rest, published_at: iso(published_at) })),
      meta: paginationMeta(q, rows[0]?.total ?? 0),
    });
  });

  router.get('/:slug', validate({ params: slugParams }), async (_req, res) => {
    const { params } = res.locals.validated as { params: z.output<typeof slugParams> };
    const post = await repo.findPublishedNews(db, params.slug);
    if (!post) throw new NotFoundError('News post not found');
    res.json({ data: { ...post, published_at: iso(post.published_at) } });
  });

  return router;
};
