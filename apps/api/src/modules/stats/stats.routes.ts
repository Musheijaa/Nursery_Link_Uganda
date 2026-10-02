import { Router } from 'express';
import type { Database } from '../../db/client.js';
import { publicStats } from './stats.repo.js';

/** GET /stats: the marketplace at a glance (home page). Read-only, so no service layer. */
export const statsRoutes = (db: Database): Router => {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json({ data: await publicStats(db) });
  });
  return router;
};
