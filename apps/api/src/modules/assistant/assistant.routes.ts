import { Router, type Response } from 'express';
import type { z } from 'zod';
import { assistantChatSchema, type AssistantEvent } from '@nurserylink/shared';
import type { Limit } from '../../middleware/rateLimit.js';
import { userOrIpKey } from '../../middleware/security.js';
import { validate } from '../../middleware/validate.js';
import type { AssistantService } from './assistant.service.js';

/** A comment line now and then keeps proxies and mobile networks from closing a quiet stream. */
const HEARTBEAT_MS = 15_000;

/** Sends what's written so far (compression adds flush(), and leaves no-transform responses alone) */
const flush = (res: Response) => {
  res.flush();
};

/**
 * The site assistant. Answers stream back as server-sent events (text/event-stream), one JSON
 * event per `data:` line (see assistantEventSchema). Problems found before streaming starts
 * (validation, switched off, limits) are ordinary JSON errors.
 */
export const assistantRoutes = (service: AssistantService, limit: Limit): Router => {
  const router = Router();
  // Each question costs a model call: a few a minute is plenty for a person, and carrier-grade NAT
  // means many people can share one IP, so the daily figure is generous
  const perMinute = limit({ windowMinutes: 1, limit: 12, key: userOrIpKey });
  const perDay = limit({ windowMinutes: 24 * 60, limit: 300, key: userOrIpKey });

  router.post('/chat', perMinute, perDay, validate({ body: assistantChatSchema }), async (req, res) => {
    const { body } = res.locals.validated as { body: z.output<typeof assistantChatSchema> };
    const chat = service.prepare(body, req.user ? { id: req.user.id, role: req.user.role } : null);

    // Stops the model when the person goes away (closed the chat, new question, lost signal)
    const abort = new AbortController();
    res.on('close', () => { abort.abort(); });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    // no-transform: no gzip here, and carriers' data-saving proxies mustn't hold the stream back
    res.setHeader('Cache-Control', 'no-store, no-transform');
    // Proxies (nginx-style) must pass each event on at once
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: AssistantEvent) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      flush(res);
    };
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': keep-alive\n\n');
        flush(res);
      }
    }, HEARTBEAT_MS);
    try {
      await chat.run(send, abort.signal);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  return router;
};
