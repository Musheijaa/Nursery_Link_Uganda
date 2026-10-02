import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { API_VERSION } from '../lib/version.js';
import { docsSecurityHeaders } from '../middleware/security.js';
import { buildOpenApiDocument } from './document.js';

/** GET /api/v1/docs (Swagger UI) and /api/v1/docs/openapi.json. Built once at startup. */
export const docsRoutes = (): Router => {
  const document = buildOpenApiDocument(API_VERSION);
  const router = Router();
  router.use(docsSecurityHeaders());
  router.get('/openapi.json', (_req, res) => {
    res.json(document);
  });
  router.use('/', swaggerUi.serveFiles(document), swaggerUi.setup(document, {
    customSiteTitle: 'Nursery Link Uganda API',
    swaggerOptions: { persistAuthorization: false, docExpansion: 'none', tagsSorter: 'alpha' },
  }));
  return router;
};
