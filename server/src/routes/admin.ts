import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { notFound } from '../lib/errors.js';
import { requireRole } from '../auth/sessions.js';
import { resolveDispute, retryPayout } from '../services/orders.js';
import { sendSms } from '../services/sms.js';
import { NURSERY_SELECT, NurseryRow, nurseryDto } from './public.js';
import { ORDER_SELECT, orderDto } from './orders.js';

export const adminRouter = Router();

adminRouter.use((req, _res, next) => {
  requireRole(req, 'admin');
  next();
});

adminRouter.get('/overview', async (_req, res) => {
  const { rows: [r] } = await query(`
    SELECT
      (SELECT count(*) FROM nurseries WHERE status = 'pending')::int AS pending_nurseries,
      (SELECT count(*) FROM orders WHERE status = 'problem_reported')::int AS disputes,
      (SELECT count(*) FROM payments p WHERE p.direction = 'payout' AND p.status = 'failed'
         AND NOT EXISTS (SELECT 1 FROM payments q WHERE q.order_id = p.order_id AND q.direction = 'payout' AND q.status <> 'failed'))::int AS failed_payouts,
      (SELECT count(*) FROM orders WHERE paid_at > now() - interval '30 days')::int AS orders_30d,
      COALESCE((SELECT sum(total_ugx) FROM orders WHERE paid_at > now() - interval '30 days'), 0)::bigint AS sales_30d_ugx,
      COALESCE((SELECT sum(total_ugx) FROM orders WHERE status IN ('payment_held', 'being_prepared', 'on_the_way', 'problem_reported')), 0)::bigint AS held_ugx`);
  res.json({
    pendingNurseries: r.pending_nurseries,
    disputes: r.disputes,
    failedPayouts: r.failed_payouts,
    orders30d: r.orders_30d,
    sales30dUGX: r.sales_30d_ugx,
    heldUGX: r.held_ugx,
  });
});

adminRouter.get('/nurseries', async (req, res) => {
  const status = z.enum(['pending', 'active', 'suspended']).default('pending').parse(req.query.status);
  const { rows } = await query<NurseryRow>(`${NURSERY_SELECT} WHERE n.status = $2 ORDER BY n.created_at`, [null, status]);
  res.json(rows.map(nurseryDto));
});

adminRouter.post('/nurseries/:id/status', async (req, res) => {
  const { status } = z.object({ status: z.enum(['active', 'suspended']) }).parse(req.body);
  if (!z.uuid().safeParse(req.params.id).success) throw notFound('Nursery not found');
  const { rows: [n] } = await query<{ name: string; phone: string }>(
    'UPDATE nurseries SET status = $2 WHERE id = $1 RETURNING name, phone', [req.params.id, status]);
  if (!n) throw notFound('Nursery not found');
  await sendSms(n.phone, status === 'active'
    ? `${n.name} is now live on Nursery Link. Buyers can see your stock and place orders.`
    : `${n.name} has been suspended on Nursery Link. Contact support for details.`);
  res.json({ ok: true });
});

adminRouter.get('/orders', async (req, res) => {
  const status = z.enum(['problem_reported', 'payment_held', 'being_prepared', 'on_the_way', 'delivered', 'cancelled', 'payment_failed', 'awaiting_payment'])
    .default('problem_reported').parse(req.query.status);
  const { rows } = await query(`${ORDER_SELECT} WHERE o.status = $1 ORDER BY o.created_at DESC LIMIT 200`, [status]);
  res.json(rows.map(o => orderDto(o, 'admin')));
});

adminRouter.get('/payouts/failed', async (_req, res) => {
  const { rows } = await query(
    `${ORDER_SELECT} WHERE EXISTS (
       SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.direction = 'payout' AND p.status = 'failed'
       AND NOT EXISTS (SELECT 1 FROM payments q WHERE q.order_id = o.id AND q.direction = 'payout' AND q.status <> 'failed'))
     ORDER BY o.created_at DESC`);
  res.json(rows.map(o => orderDto(o, 'admin')));
});

adminRouter.post('/orders/:id/resolve', async (req, res) => {
  const admin = requireRole(req, 'admin');
  const { action, note } = z.object({
    action: z.enum(['release', 'refund']),
    note: z.string().trim().min(5, 'Record why you made this decision').max(500),
  }).parse(req.body);
  await resolveDispute(req.params.id, admin.id, action, note);
  const { rows: [o] } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [req.params.id]);
  res.json(orderDto(o, 'admin'));
});

adminRouter.post('/orders/:id/retry-payout', async (req, res) => {
  await retryPayout(req.params.id);
  const { rows: [o] } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [req.params.id]);
  res.json(orderDto(o, 'admin'));
});
