import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { detectNetwork } from '../lib/phone.js';
import { SessionUser, requireRole } from '../auth/sessions.js';
import { advanceByNursery, confirmDelivery } from '../services/orders.js';
import { nurseryProfileSchema } from './auth.js';
import { NURSERY_SELECT, NurseryRow, nurseryDto } from './public.js';
import { ORDER_SELECT, orderDto } from './orders.js';

/** Routes for signed-in nursery owners, under /api/my. Admins may use them for any nursery. */
export const nurseryRouter = Router();

const assertOwns = async (user: SessionUser, nurseryId: string) => {
  if (!z.uuid().safeParse(nurseryId).success) throw notFound('Nursery not found');
  const { rows: [n] } = await query<{ owner_id: string }>('SELECT owner_id FROM nurseries WHERE id = $1', [nurseryId]);
  if (!n) throw notFound('Nursery not found');
  if (user.role !== 'admin' && n.owner_id !== user.id) throw forbidden();
};

const ownerOfOrder = async (user: SessionUser, orderId: string) => {
  if (!z.uuid().safeParse(orderId).success) throw notFound('Order not found');
  const { rows: [o] } = await query<{ nursery_id: string }>('SELECT nursery_id FROM orders WHERE id = $1', [orderId]);
  if (!o) throw notFound('Order not found');
  await assertOwns(user, o.nursery_id);
  return o.nursery_id;
};

const loadNurseryOrder = async (orderId: string) => {
  const { rows: [o] } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  return orderDto(o, 'nursery');
};

nurseryRouter.get('/nurseries', async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  const { rows } = await query<NurseryRow & { payout_phone: string; payout_network: string }>(
    `${NURSERY_SELECT.replace('n.status,', 'n.status, n.payout_phone, n.payout_network,')} WHERE n.owner_id = $2 ORDER BY n.created_at`,
    [null, user.id]
  );

  const stats = await query<{ nursery_id: string; open_orders: number; held_ugx: number; paid_ugx: number }>(
    `SELECT o.nursery_id,
            count(*) FILTER (WHERE o.status IN ('payment_held', 'being_prepared', 'on_the_way', 'problem_reported'))::int AS open_orders,
            COALESCE(sum(o.total_ugx) FILTER (WHERE o.status IN ('payment_held', 'being_prepared', 'on_the_way', 'problem_reported')), 0)::bigint AS held_ugx,
            COALESCE(sum(o.total_ugx) FILTER (WHERE o.status = 'delivered'), 0)::bigint AS paid_ugx
     FROM orders o JOIN nurseries n ON n.id = o.nursery_id WHERE n.owner_id = $1 GROUP BY o.nursery_id`,
    [user.id]
  );

  res.json(rows.map(n => {
    const s = stats.rows.find(x => x.nursery_id === n.id);
    return {
      ...nurseryDto(n),
      payoutPhone: n.payout_phone,
      payoutNetwork: n.payout_network,
      stats: { openOrders: s?.open_orders ?? 0, heldUGX: s?.held_ugx ?? 0, paidUGX: s?.paid_ugx ?? 0 },
    };
  }));
});

nurseryRouter.patch('/nurseries/:id', async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  await assertOwns(user, req.params.id);
  const body = nurseryProfileSchema
    .pick({ operatorName: true, description: true, openingHours: true, deliveryMethods: true, payoutPhone: true })
    .partial()
    .parse(req.body);

  const payoutNetwork = body.payoutPhone ? detectNetwork(body.payoutPhone) : undefined;
  if (body.payoutPhone && !payoutNetwork) throw badRequest('The payout number must be an MTN or Airtel number');

  await query(
    `UPDATE nurseries SET
       operator_name = COALESCE($2, operator_name),
       description = COALESCE($3, description),
       opening_hours = COALESCE($4, opening_hours),
       delivery_methods = COALESCE($5::delivery_method[], delivery_methods),
       payout_phone = COALESCE($6, payout_phone),
       payout_network = COALESCE($7::payment_network, payout_network)
     WHERE id = $1`,
    [req.params.id, body.operatorName ?? null, body.description ?? null, body.openingHours ?? null,
      body.deliveryMethods ?? null, body.payoutPhone ?? null, payoutNetwork ?? null]
  );
  res.json({ ok: true });
});

const batchSchema = z.object({
  speciesId: z.string().min(1).max(60),
  seedlingType: z.enum(['Potted seedling', 'Root trainer', 'Grafted', 'Cutting']),
  ageMonths: z.number().int().min(1).max(120),
  heightCm: z.number().int().min(1).max(1000),
  unitPriceUGX: z.number().int().min(50).max(1_000_000),
  quantityAvailable: z.number().int().min(0).max(10_000_000),
  status: z.enum(['Ready', 'Ready soon']).default('Ready'),
});

nurseryRouter.post('/nurseries/:id/batches', async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  await assertOwns(user, req.params.id);
  const b = batchSchema.parse(req.body);
  const { rows: [species] } = await query('SELECT 1 FROM species WHERE id = $1', [b.speciesId]);
  if (!species) throw badRequest('Choose a tree from the list');

  const { rows: [created] } = await query(
    `INSERT INTO seedling_batches (nursery_id, species_id, seedling_type, age_months, height_cm, unit_price_ugx, quantity_available, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [req.params.id, b.speciesId, b.seedlingType, b.ageMonths, b.heightCm, b.unitPriceUGX, b.quantityAvailable, b.status]
  );
  res.status(201).json({ id: created.id });
});

nurseryRouter.patch('/batches/:id', async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  if (!z.uuid().safeParse(req.params.id).success) throw notFound('Batch not found');
  const { rows: [batch] } = await query<{ nursery_id: string }>('SELECT nursery_id FROM seedling_batches WHERE id = $1', [req.params.id]);
  if (!batch) throw notFound('Batch not found');
  await assertOwns(user, batch.nursery_id);

  const body = batchSchema.pick({ unitPriceUGX: true, quantityAvailable: true, status: true }).partial().parse(req.body);
  const { rows: [updated] } = await query(
    `UPDATE seedling_batches SET
       unit_price_ugx = COALESCE($2, unit_price_ugx),
       quantity_available = COALESCE($3, quantity_available),
       status = COALESCE($4::batch_status, status)
     WHERE id = $1
     RETURNING id, unit_price_ugx AS "unitPriceUGX", quantity_available AS "quantityAvailable", status`,
    [req.params.id, body.unitPriceUGX ?? null, body.quantityAvailable ?? null, body.status ?? null]
  );
  res.json(updated);
});

nurseryRouter.get('/nurseries/:id/orders', async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  await assertOwns(user, req.params.id);
  const scope = req.query.scope === 'all' ? 'all' : 'open';
  const { rows } = await query(
    `${ORDER_SELECT} WHERE o.nursery_id = $1
       AND (${scope === 'all' ? `o.status <> 'awaiting_payment'` : `o.status IN ('payment_held', 'being_prepared', 'on_the_way', 'problem_reported')`})
     ORDER BY o.created_at DESC LIMIT 200`,
    [req.params.id]
  );
  res.json(rows.map(o => orderDto(o, 'nursery')));
});

nurseryRouter.post('/orders/:id/advance', async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  await ownerOfOrder(user, req.params.id);
  const { to } = z.object({ to: z.enum(['being_prepared', 'on_the_way']) }).parse(req.body);
  await advanceByNursery(req.params.id, user.id, to);
  res.json(await loadNurseryOrder(req.params.id));
});

nurseryRouter.post('/orders/:id/confirm-delivery', async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  await ownerOfOrder(user, req.params.id);
  const { code } = z.object({ code: z.string().regex(/^\d{4}$/, 'Enter the 4-digit code') }).parse(req.body);
  await confirmDelivery(req.params.id, user.id, code);
  res.json(await loadNurseryOrder(req.params.id));
});

/** A farmer collects free seedlings: the nursery checks and redeems their voucher code. */
nurseryRouter.post('/nurseries/:id/vouchers/redeem', async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  await assertOwns(user, req.params.id);
  const { code } = z.object({ code: z.string().trim().toUpperCase().regex(/^NLV-\d{3}-\d{3}$/, 'Voucher codes look like NLV-123-456') }).parse(req.body);

  const { rows: [v] } = await query<{ status: string; seedlings: number; applicant_name: string; title: string; is_partner: boolean }>(
    `SELECT v.status, v.seedlings, v.applicant_name, p.title,
            EXISTS (SELECT 1 FROM programme_collection_nurseries pc WHERE pc.programme_id = v.programme_id AND pc.nursery_id = $2) AS is_partner
     FROM vouchers v JOIN programmes p ON p.id = v.programme_id WHERE v.code = $1`,
    [code, req.params.id]
  );
  if (!v) throw notFound('No voucher with that code');
  if (!v.is_partner) throw forbidden('Your nursery is not a collection point for this programme');
  if (v.status !== 'issued') throw conflict(`This voucher has already been ${v.status}`);

  await query(`UPDATE vouchers SET status = 'redeemed', redeemed_at = now(), redeemed_nursery_id = $2 WHERE code = $1 AND status = 'issued'`, [code, req.params.id]);
  res.json({ code, seedlings: v.seedlings, applicantName: v.applicant_name, programme: v.title });
});
