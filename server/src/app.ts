import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, isSimulatedPayments } from './config.js';
import { pool } from './db/pool.js';
import { loadUser } from './auth/sessions.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { publicRouter } from './routes/public.js';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';
import { nurseryRouter } from './routes/nursery.js';
import { adminRouter } from './routes/admin.js';
import { webhooksRouter } from './routes/webhooks.js';

export const createApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
      },
    },
  }));
  app.use(cors({ origin: config.APP_URL, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true, payments: isSimulatedPayments ? 'simulated' : 'live', sms: config.SMS_MODE });
  });
  api.use('/webhooks', webhooksRouter);
  api.use(loadUser);
  api.use('/auth', authRouter);
  api.use(publicRouter);
  api.use(ordersRouter);
  api.use('/my', nurseryRouter);
  api.use('/admin', adminRouter);
  api.use(notFoundHandler);

  app.use('/api', api);

  // In production the API also serves the built site
  const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
  if (config.NODE_ENV === 'production' && existsSync(siteDir)) {
    app.use(express.static(siteDir, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(siteDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
};
