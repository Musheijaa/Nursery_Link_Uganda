import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { z } from 'zod';
import { enquiryCreateSchema, feedbackCreateSchema } from '@nurserylink/shared';
import type { Logger } from 'pino';
import type { Limit } from '../../middleware/rateLimit.js';
import { userOrIpKey } from '../../middleware/security.js';
import { validate } from '../../middleware/validate.js';
import type { EnquiriesService } from './enquiries.service.js';

/**
 * Public forms: Expert Services requests, Donate (donation, partnership, contact) and site feedback.
 * No account needed. Generous per-IP limits, because many people share one IP on mobile networks.
 */
export const enquiriesRoutes = (service: EnquiriesService, limit: Limit, logger: Logger): { enquiries: Router; feedback: Router } => {
  const enquiries = Router();
  const feedback = Router();
  const createLimit = limit({ windowMinutes: 60, limit: 20, key: userOrIpKey });

  enquiries.post('/', createLimit, validate({ body: enquiryCreateSchema }), async (req, res) => {
    const { body } = res.locals.validated as { body: z.output<typeof enquiryCreateSchema> };
    // The spam trap is a field people never see: a bot gets a normal-looking answer and nothing is saved
    if (body.website) {
      logger.info({ type: body.type }, 'Enquiry dropped: spam trap filled in');
      res.status(201).json({ data: { id: randomUUID(), created_at: new Date().toISOString() } });
      return;
    }
    res.status(201).json({ data: await service.create(req.user?.id ?? null, body) });
  });

  feedback.post('/', createLimit, validate({ body: feedbackCreateSchema }), async (req, res) => {
    const { body } = res.locals.validated as { body: z.output<typeof feedbackCreateSchema> };
    res.status(201).json({ data: await service.createFeedback(req.user?.id ?? null, body) });
  });

  return { enquiries, feedback };
};
