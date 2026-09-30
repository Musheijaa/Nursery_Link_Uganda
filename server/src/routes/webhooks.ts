import { Router } from 'express';
import { query } from '../db/pool.js';
import { applyCollectionResult, applyPayoutResult } from '../services/orders.js';
import { providerByName } from '../services/payments/index.js';
import type { ProviderName } from '../services/payments/types.js';

/**
 * Provider callbacks. The body is only used to find which payment changed; the outcome is always
 * re-fetched from the provider's API, so a forged callback cannot mark a payment as successful.
 */
export const webhooksRouter = Router();

const refresh = async (where: string, value: string) => {
  const { rows: [p] } = await query<{ id: string; reference: string; provider: ProviderName; direction: 'collection' | 'payout' }>(
    `SELECT id, reference, provider, direction FROM payments WHERE ${where} AND status = 'pending'`, [value]);
  if (!p) return;
  const provider = providerByName(p.provider);
  if (p.direction === 'collection') await applyCollectionResult(p.id, await provider.getPaymentStatus(p.reference));
  else await applyPayoutResult(p.id, await provider.getPayoutStatus(p.reference));
};

const acknowledge = (handler: (body: Record<string, unknown>) => Promise<void>) =>
  async (req: import('express').Request, res: import('express').Response) => {
    // Always answer 200 quickly so providers do not keep retrying; failures are picked up by polling
    res.sendStatus(200);
    try {
      await handler(req.body ?? {});
    } catch (err) {
      console.error('Webhook processing failed:', err);
    }
  };

// MTN sends the X-Reference-Id we generated back as externalId
const mtn = acknowledge(async body => {
  const ref = String(body.externalId ?? body.referenceId ?? '');
  if (/^[0-9a-f-]{36}$/i.test(ref)) await refresh(`reference = $1::uuid AND provider = 'mtn_momo'`, ref);
});
webhooksRouter.post('/mtn', mtn);
webhooksRouter.put('/mtn', mtn);

// Airtel sends our transaction id (the reference without dashes)
webhooksRouter.post('/airtel', acknowledge(async body => {
  const tx = (body.transaction ?? {}) as Record<string, unknown>;
  const id = String(tx.id ?? '');
  if (/^[0-9a-f]{32}$/i.test(id)) await refresh(`replace(reference::text, '-', '') = $1 AND provider = 'airtel_money'`, id.toLowerCase());
}));
