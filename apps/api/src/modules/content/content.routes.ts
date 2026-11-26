import { Router } from 'express';
import type { ContentService } from './content.service.js';

/** Public reads: Expert Services, partner logos and the editable site copy. Small, so unpaginated. */
export const contentRoutes = (service: ContentService): Router => {
  const router = Router();

  router.get('/expert-services', async (_req, res) => {
    res.json({ data: await service.serviceCategories(true) });
  });

  router.get('/partners', async (_req, res) => {
    res.json({ data: await service.partners(true) });
  });

  router.get('/page-content', async (_req, res) => {
    res.json({ data: await service.pageContent() });
  });

  return router;
};
