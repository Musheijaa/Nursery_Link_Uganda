import { Router } from 'express';
import { z } from 'zod';
import type { Limit } from '../../middleware/rateLimit.js';
import { userOrIpKey } from '../../middleware/security.js';
import { validate } from '../../middleware/validate.js';
import type { SearchService } from './search.service.js';

const kinds = ['species', 'nursery', 'place'] as const;

export const suggestQuery = z.object({
  q: z.string().trim().min(1).max(100),
  /** Comma-separated kinds to suggest; all of them when omitted */
  types: z
    .string()
    .transform(v => v.split(',').map(t => t.trim()).filter(Boolean))
    .pipe(z.array(z.enum(kinds)).min(1))
    .optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const placesQuery = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

/** Search suggestions and place search. Read-only; the rules live in SearchService. */
export const searchRoutes = (service: SearchService, limit: Limit): Router => {
  const router = Router();
  // Suggestions fire as people type (debounced in the apps)
  const suggestLimit = limit({ windowMinutes: 1, limit: 120, key: userOrIpKey });
  // Each place search may go out to OpenStreetMap
  const placesLimit = limit({ windowMinutes: 1, limit: 30, key: userOrIpKey });

  router.get('/search/suggest', suggestLimit, validate({ query: suggestQuery }), async (_req, res) => {
    const { query } = res.locals.validated as { query: z.output<typeof suggestQuery> };
    res.json({ data: await service.suggest(query.q, query.types ?? [...kinds], query.limit) });
  });

  router.get('/places', placesLimit, validate({ query: placesQuery }), async (_req, res) => {
    const { query } = res.locals.validated as { query: z.output<typeof placesQuery> };
    const { items, osm } = await service.places(query.q, query.limit);
    res.json({ data: items, meta: { osm } });
  });

  return router;
};
