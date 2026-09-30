import { Router } from 'express';
import { z } from 'zod';
import { isSimulatedPayments } from '../config.js';
import { query, withTransaction } from '../db/pool.js';
import { randomDigits } from '../lib/crypto.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { phoneSchema } from '../lib/phone.js';
import { requireUser } from '../auth/sessions.js';
import {
  applyCollectionResult,
  cancelUnpaidOrder,
  confirmDelivery,
  createOrder,
  OrderStatus,
  reportProblem,
} from '../services/orders.js';
import { sendSms } from '../services/sms.js';

export const ordersRouter = Router();

// ── Order projections ──────────────────────────────────────

export const ORDER_SELECT = `
  SELECT o.*, d.name AS delivery_district, n.name AS nursery_name, n.phone AS nursery_phone, nd.name AS nursery_district,
    (SELECT json_agg(json_build_object('speciesId', i.species_id, 'speciesName', s.common_name, 'seedlingType', i.seedling_type,
                                       'quantity', i.quantity, 'unitPriceUGX', i.unit_price_ugx) ORDER BY s.common_name)
     FROM order_items i JOIN species s ON s.id = i.species_id WHERE i.order_id = o.id) AS items,
    (SELECT json_build_object('status', p.status, 'network', p.network, 'phone', p.phone, 'failureReason', p.failure_reason)
     FROM payments p WHERE p.order_id = o.id AND p.direction = 'collection' ORDER BY p.created_at DESC LIMIT 1) AS payment,
    (SELECT json_build_object('status', p.status, 'amountUGX', p.amount_ugx)
     FROM payments p WHERE p.order_id = o.id AND p.direction = 'payout' ORDER BY p.created_at DESC LIMIT 1) AS payout,
    (SELECT json_agg(json_build_object('status', e.status, 'at', e.created_at, 'note', e.note) ORDER BY e.created_at)
     FROM order_events e WHERE e.order_id = o.id) AS events
  FROM orders o
  JOIN districts d ON d.id = o.delivery_district_id
  JOIN nurseries n ON n.id = o.nursery_id
  JOIN districts nd ON nd.id = n.district_id
`;

const PAID_STATUSES: OrderStatus[] = ['payment_held', 'being_prepared', 'on_the_way', 'problem_reported'];

type OrderRow = Record<string, any>;

export const orderDto = (o: OrderRow, audience: 'buyer' | 'nursery' | 'admin') => ({
  id: o.id,
  orderNumber: o.order_number,
  createdAt: o.created_at,
  status: o.status as OrderStatus,
  nursery: { id: o.nursery_id, name: o.nursery_name, phone: o.nursery_phone, district: o.nursery_district },
  buyer: { name: o.buyer_name, phone: o.buyer_phone },
  deliveryMethod: o.delivery_method,
  deliveryDistrict: o.delivery_district,
  deliveryArea: o.delivery_area,
  deliveryLandmark: o.delivery_landmark,
  distanceKm: o.distance_km,
  items: o.items ?? [],
  seedlingsTotalUGX: o.seedlings_total_ugx,
  deliveryFeeUGX: o.delivery_fee_ugx,
  totalUGX: o.total_ugx,
  payment: o.payment,
  payout: o.payout,
  events: o.events ?? [],
  // The code is the buyer's proof of delivery: never show it to the nursery, and only once paid
  deliveryCode: audience === 'buyer' && PAID_STATUSES.includes(o.status) ? o.delivery_code : undefined,
});

const loadOwnOrder = async (orderId: string, userId: string) => {
  if (!z.uuid().safeParse(orderId).success) throw notFound('Order not found');
  const { rows: [order] } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  if (!order) throw notFound('Order not found');
  if (order.buyer_id !== userId) throw forbidden();
  return order;
};

// ── Buyer endpoints ────────────────────────────────────────

const createOrderSchema = z.object({
  nurseryId: z.uuid(),
  items: z.array(z.object({ batchId: z.uuid(), quantity: z.number().int().positive().max(1_000_000) })).min(1).max(30),
  deliveryMethod: z.enum(['Collect from nursery', 'Boda boda', 'Truck']),
  deliveryDistrict: z.string().trim().max(60).default(''),
  deliveryArea: z.string().trim().max(120).default(''),
  deliveryLandmark: z.string().trim().max(160).default(''),
  buyerName: z.string().trim().min(2, 'Enter your name').max(80),
  paymentNetwork: z.enum(['MTN MoMo', 'Airtel Money']),
  paymentPhone: phoneSchema,
}).refine(o => o.deliveryMethod === 'Collect from nursery' || (o.deliveryDistrict && o.deliveryArea.length >= 2), {
  message: 'Enter the district and area for delivery',
  path: ['deliveryArea'],
});

ordersRouter.post('/orders', async (req, res) => {
  const user = requireUser(req);
  const input = createOrderSchema.parse(req.body);
  const orderId = await createOrder(user, input);
  const { rows: [order] } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  res.status(201).json(orderDto(order, 'buyer'));
});

ordersRouter.get('/orders', async (req, res) => {
  const user = requireUser(req);
  const { rows } = await query(`${ORDER_SELECT} WHERE o.buyer_id = $1 ORDER BY o.created_at DESC LIMIT 100`, [user.id]);
  res.json(rows.map(o => orderDto(o, 'buyer')));
});

ordersRouter.get('/orders/:id', async (req, res) => {
  const user = requireUser(req);
  res.json(orderDto(await loadOwnOrder(req.params.id, user.id), 'buyer'));
});

ordersRouter.post('/orders/:id/cancel', async (req, res) => {
  const user = requireUser(req);
  await loadOwnOrder(req.params.id, user.id);
  await cancelUnpaidOrder(req.params.id, user.id);
  res.json(orderDto(await loadOwnOrder(req.params.id, user.id), 'buyer'));
});

ordersRouter.post('/orders/:id/confirm-delivery', async (req, res) => {
  const user = requireUser(req);
  await loadOwnOrder(req.params.id, user.id);
  await confirmDelivery(req.params.id, user.id);
  res.json(orderDto(await loadOwnOrder(req.params.id, user.id), 'buyer'));
});

ordersRouter.post('/orders/:id/report-problem', async (req, res) => {
  const user = requireUser(req);
  const { note } = z.object({ note: z.string().trim().min(5, 'Tell us briefly what went wrong').max(500) }).parse(req.body);
  await loadOwnOrder(req.params.id, user.id);
  await reportProblem(req.params.id, user.id, note);
  res.json(orderDto(await loadOwnOrder(req.params.id, user.id), 'buyer'));
});

/**
 * Development only: stands in for the buyer approving (or declining) the Mobile Money prompt.
 * Not mounted at all when real payment providers are configured.
 */
if (isSimulatedPayments) {
  ordersRouter.post('/orders/:id/simulate-payment', async (req, res) => {
    const user = requireUser(req);
    const { outcome } = z.object({ outcome: z.enum(['approve', 'decline']) }).parse(req.body);
    await loadOwnOrder(req.params.id, user.id);
    const { rows: [payment] } = await query<{ id: string }>(
      `SELECT id FROM payments WHERE order_id = $1 AND direction = 'collection' AND status = 'pending'`, [req.params.id]);
    if (!payment) throw conflict('This order is not waiting for payment');
    await applyCollectionResult(payment.id, outcome === 'approve'
      ? { status: 'successful', providerReference: `SIM-${randomDigits(10)}` }
      : { status: 'failed', reason: 'Declined on phone' });
    res.json(orderDto(await loadOwnOrder(req.params.id, user.id), 'buyer'));
  });
}

// ── Free seedling programmes ───────────────────────────────

const voucherCode = () => `NLV-${randomDigits(3)}-${randomDigits(3)}`;

ordersRouter.post('/programmes/:id/apply', async (req, res) => {
  const user = requireUser(req);
  const body = z.object({
    name: z.string().trim().min(2, 'Enter your name as it appears on your ID').max(80),
    district: z.string().trim().min(1).max(60),
    seedlings: z.number().int().positive(),
  }).parse(req.body);

  const voucher = await withTransaction(async db => {
    const { rows: [p] } = await db.query<{ id: string; title: string; status: string; deadline: string; max_per_applicant: number; total_seedlings: number; seedlings_claimed: number }>(
      `SELECT id, title, status, deadline, max_per_applicant, total_seedlings, seedlings_claimed FROM programmes WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!p) throw notFound('Programme not found');
    if (p.status !== 'Open' || p.deadline < new Date().toISOString().slice(0, 10)) throw badRequest('This programme is not accepting applications');

    const { rows: [district] } = await db.query<{ id: number; allowed: boolean }>(
      `SELECT d.id, (NOT EXISTS (SELECT 1 FROM programme_districts WHERE programme_id = $2)
                     OR EXISTS (SELECT 1 FROM programme_districts WHERE programme_id = $2 AND district_id = d.id)) AS allowed
       FROM districts d WHERE d.name = $1`,
      [body.district, p.id]
    );
    if (!district) throw badRequest('Choose a district from the list');
    if (!district.allowed) throw badRequest('This programme does not cover that district');

    const remaining = p.total_seedlings - p.seedlings_claimed;
    const limit = Math.min(p.max_per_applicant, remaining);
    if (limit <= 0) throw conflict('All seedlings in this programme have been given out');
    if (body.seedlings > limit) throw badRequest(`You can request up to ${limit.toLocaleString('en-UG')} seedlings`);

    const existing = await db.query('SELECT 1 FROM vouchers WHERE programme_id = $1 AND phone = $2', [p.id, user.phone]);
    if (existing.rowCount) throw conflict('You have already applied to this programme with this phone number', 'already_applied');

    // Retry on the rare code collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = voucherCode();
      const { rows: [v] } = await db.query(
        `INSERT INTO vouchers (code, programme_id, applicant_name, phone, district_id, seedlings)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (code) DO NOTHING RETURNING code, seedlings, issued_at`,
        [code, p.id, body.name, user.phone, district.id, body.seedlings]
      );
      if (v) {
        await db.query('UPDATE programmes SET seedlings_claimed = seedlings_claimed + $2 WHERE id = $1', [p.id, body.seedlings]);
        return { ...v, programmeTitle: p.title, deadline: p.deadline };
      }
    }
    throw new Error('Could not generate a unique voucher code');
  });

  await sendSms(user.phone, `Your Nursery Link voucher ${voucher.code} is for ${voucher.seedlings} free seedlings (${voucher.programmeTitle}). Collect before ${voucher.deadline} with your national ID.`);
  res.status(201).json({ code: voucher.code, seedlings: voucher.seedlings, issuedAt: voucher.issued_at, programmeId: req.params.id });
});

ordersRouter.get('/vouchers', async (req, res) => {
  const user = requireUser(req);
  const { rows } = await query(
    `SELECT v.code, v.programme_id, v.seedlings, v.status, v.issued_at, v.redeemed_at, d.name AS district
     FROM vouchers v JOIN districts d ON d.id = v.district_id WHERE v.phone = $1 ORDER BY v.issued_at DESC`,
    [user.phone]
  );
  res.json(rows.map(v => ({
    code: v.code, programmeId: v.programme_id, seedlings: v.seedlings, status: v.status,
    issuedAt: v.issued_at, redeemedAt: v.redeemed_at, district: v.district,
  })));
});
