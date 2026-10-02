import { sql, type SQL } from 'drizzle-orm';
import type {
  DeliveryType,
  OrderStatus,
  PaymentKind,
  PaymentMethod,
  PaymentProviderName,
  PaymentStatus,
  Vehicle,
} from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import type { LatLng } from '../../lib/geo.js';

// ── Quoting ────────────────────────────────────────────────

export type QuoteNurseryRow = { id: string; name: string; lat: number; lng: number };

export const findActiveNursery = async (db: DbOrTx, id: string): Promise<QuoteNurseryRow | undefined> =>
  (await db.execute<QuoteNurseryRow>(sql`
    SELECT id, name, ST_Y(location) AS lat, ST_X(location) AS lng FROM nurseries WHERE id = ${id} AND is_active`)).rows[0];

export type StockRow = {
  id: string;
  nursery_id: string;
  species_id: string;
  slug: string;
  common_name: string;
  quantity_available: number;
  unit_price: number;
};

/**
 * Stock lines by id. With lock=true the rows are locked FOR UPDATE in id order, so two orders
 * touching the same lines always lock them in the same order and cannot deadlock.
 */
export const stockLines = async (db: DbOrTx, ids: string[], lock = false): Promise<StockRow[]> => {
  if (ids.length === 0) return [];
  const list = sql.join(ids.map(id => sql`${id}::uuid`), sql`, `);
  return (
    await db.execute<StockRow>(sql`
      SELECT i.id, i.nursery_id, i.species_id, s.slug, s.common_name, i.quantity_available, i.unit_price
      FROM inventory i JOIN species s ON s.id = i.species_id
      WHERE i.id IN (${list})
      ORDER BY i.id
      ${lock ? sql`FOR UPDATE OF i` : sql``}`)
  ).rows;
};

export type RateRow = { id: string; vehicle: Vehicle; max_items: number; base_fee: number; per_km: number; max_km: number };

export const activeRates = async (db: DbOrTx): Promise<RateRow[]> =>
  (await db.execute<RateRow>(sql`SELECT id, vehicle, max_items, base_fee, per_km, max_km FROM delivery_rates WHERE active`)).rows;

// ── Creating orders ────────────────────────────────────────

export const decrementStock = async (db: DbOrTx, inventoryId: string, quantity: number): Promise<void> => {
  await db.execute(sql`UPDATE inventory SET quantity_available = quantity_available - ${quantity} WHERE id = ${inventoryId}`);
};

/** Puts an order's seedlings back on the shelf (cancelled or failed payment). */
export const restoreStock = async (db: DbOrTx, orderId: string): Promise<void> => {
  await db.execute(sql`
    UPDATE inventory i SET quantity_available = i.quantity_available + oi.quantity
    FROM order_items oi WHERE oi.order_id = ${orderId} AND oi.inventory_id = i.id`);
};

export interface NewOrder {
  shortCode: string;
  userId: string;
  nurseryId: string;
  deliveryType: DeliveryType;
  deliveryPoint: LatLng | null;
  deliveryAddress: string | null;
  distanceKm: number | null;
  deliveryFee: number;
  itemsTotal: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
}

/** Inserts the order; returns undefined if the short code is already taken (caller retries). */
export const insertOrder = async (db: DbOrTx, o: NewOrder): Promise<string | undefined> => {
  const point = o.deliveryPoint ? sql`ST_SetSRID(ST_MakePoint(${o.deliveryPoint.lng}, ${o.deliveryPoint.lat}), 4326)` : sql`NULL`;
  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO orders (short_code, user_id, nursery_id, delivery_type, delivery_point, delivery_address, distance_km,
                        delivery_fee, items_total, grand_total, payment_method)
    VALUES (${o.shortCode}, ${o.userId}, ${o.nurseryId}, ${o.deliveryType}, ${point}, ${o.deliveryAddress}, ${o.distanceKm},
            ${o.deliveryFee}, ${o.itemsTotal}, ${o.grandTotal}, ${o.paymentMethod})
    ON CONFLICT (short_code) DO NOTHING
    RETURNING id`);
  return result.rows[0]?.id;
};

export const insertOrderItem = async (
  db: DbOrTx,
  item: { orderId: string; inventoryId: string; speciesId: string; quantity: number; unitPrice: number }
): Promise<void> => {
  await db.execute(sql`
    INSERT INTO order_items (order_id, inventory_id, species_id, quantity, unit_price_snapshot, line_total)
    VALUES (${item.orderId}, ${item.inventoryId}, ${item.speciesId}, ${item.quantity}, ${item.unitPrice}, ${item.quantity * item.unitPrice})`);
};

// ── Payments ───────────────────────────────────────────────

export type PaymentRow = {
  id: string;
  order_id: string;
  kind: PaymentKind;
  provider: PaymentProviderName;
  provider_ref: string | null;
  idempotency_key: string;
  msisdn: string;
  amount: number;
  status: PaymentStatus;
  created_at: Date;
  updated_at: Date;
};

export const insertPayment = async (
  db: DbOrTx,
  p: { orderId: string; kind: PaymentKind; provider: PaymentProviderName; msisdn: string; amount: number; idempotencyKey?: string }
): Promise<PaymentRow> => {
  const result = await db.execute<PaymentRow>(sql`
    INSERT INTO payments (order_id, kind, provider, msisdn, amount${p.idempotencyKey ? sql`, idempotency_key` : sql``})
    VALUES (${p.orderId}, ${p.kind}, ${p.provider}, ${p.msisdn}, ${p.amount}${p.idempotencyKey ? sql`, ${p.idempotencyKey}` : sql``})
    RETURNING *`);
  const row = result.rows[0];
  if (!row) throw new Error('Payment insert returned no row');
  return row;
};

export const findPayment = async (db: DbOrTx, id: string, lock = false): Promise<PaymentRow | undefined> =>
  (await db.execute<PaymentRow>(sql`SELECT * FROM payments WHERE id = ${id} ${lock ? sql`FOR UPDATE` : sql``}`)).rows[0];

/** A webhook may identify the payment by the provider's reference or by our idempotency key. */
export const findPaymentByReference = async (db: DbOrTx, provider: PaymentProviderName, reference: string): Promise<PaymentRow | undefined> =>
  (
    await db.execute<PaymentRow>(sql`
      SELECT * FROM payments
      WHERE provider = ${provider} AND (provider_ref = ${reference} OR idempotency_key::text = ${reference})
      LIMIT 1`)
  ).rows[0];

export const setProviderRef = async (db: DbOrTx, paymentId: string, providerRef: string): Promise<void> => {
  await db.execute(sql`UPDATE payments SET provider_ref = ${providerRef} WHERE id = ${paymentId}`);
};

export const settlePayment = async (db: DbOrTx, paymentId: string, status: 'successful' | 'failed', raw: unknown): Promise<void> => {
  await db.execute(sql`UPDATE payments SET status = ${status}, raw_callback = ${JSON.stringify(raw ?? null)}::jsonb WHERE id = ${paymentId}`);
};

export const collectionForOrder = async (db: DbOrTx, orderId: string): Promise<PaymentRow | undefined> =>
  (await db.execute<PaymentRow>(sql`SELECT * FROM payments WHERE order_id = ${orderId} AND kind = 'collection' ORDER BY created_at DESC LIMIT 1`)).rows[0];

/** Payouts (disbursements and refunds) for an order, newest first. */
export const payoutsForOrder = async (db: DbOrTx, orderId: string): Promise<PaymentRow[]> =>
  (await db.execute<PaymentRow>(sql`SELECT * FROM payments WHERE order_id = ${orderId} AND kind <> 'collection' ORDER BY created_at DESC`)).rows;

export type PayoutListRow = PaymentRow & { short_code: string; order_status: OrderStatus; nursery_name: string; attempts: number; total: number };

export const listPayouts = async (db: DbOrTx, status: PaymentStatus | undefined, limit: number, offset: number): Promise<PayoutListRow[]> =>
  (
    await db.execute<PayoutListRow>(sql`
      SELECT p.*, o.short_code, o.status AS order_status, n.name AS nursery_name,
             (SELECT count(*) FROM payments q WHERE q.order_id = p.order_id AND q.kind = p.kind)::int AS attempts,
             count(*) OVER ()::int AS total
      FROM payments p JOIN orders o ON o.id = p.order_id JOIN nurseries n ON n.id = o.nursery_id
      WHERE p.kind <> 'collection' ${status ? sql`AND p.status = ${status}` : sql``}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`)
  ).rows;

// ── Reading orders ─────────────────────────────────────────

export type OrderRow = {
  id: string;
  short_code: string;
  user_id: string;
  buyer_name: string;
  buyer_phone: string;
  nursery_id: string;
  nursery_name: string;
  nursery_contact_phone: string;
  nursery_payout_phone: string;
  nursery_lat: number;
  nursery_lng: number;
  delivery_type: DeliveryType;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_address: string | null;
  distance_km: number | null;
  delivery_fee: number;
  items_total: number;
  grand_total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  paid_at: Date | null;
  dispatched_at: Date | null;
  delivered_at: Date | null;
  released_at: Date | null;
  created_at: Date;
  items: { inventory_id: string; species_id: string; slug: string; common_name: string; quantity: number; unit_price: number; line_total: number }[];
  total: number;
};

const selectOrders = async (db: DbOrTx, where: SQL, limit: number, offset: number): Promise<OrderRow[]> =>
  (
    await db.execute<OrderRow>(sql`
      SELECT o.id, o.short_code, o.user_id, u.full_name AS buyer_name, u.phone AS buyer_phone,
             o.nursery_id, n.name AS nursery_name, n.contact_phone AS nursery_contact_phone, n.payout_phone AS nursery_payout_phone,
             ST_Y(n.location) AS nursery_lat, ST_X(n.location) AS nursery_lng,
             o.delivery_type, ST_Y(o.delivery_point) AS delivery_lat, ST_X(o.delivery_point) AS delivery_lng, o.delivery_address,
             o.distance_km::float8 AS distance_km, o.delivery_fee, o.items_total, o.grand_total, o.status, o.payment_method,
             o.paid_at, o.dispatched_at, o.delivered_at, o.released_at, o.created_at,
             COALESCE((SELECT json_agg(json_build_object('inventory_id', oi.inventory_id, 'species_id', s.id, 'slug', s.slug,
                              'common_name', s.common_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price_snapshot,
                              'line_total', oi.line_total) ORDER BY s.common_name)
                       FROM order_items oi JOIN species s ON s.id = oi.species_id WHERE oi.order_id = o.id), '[]'::json) AS items,
             count(*) OVER ()::int AS total
      FROM orders o JOIN users u ON u.id = o.user_id JOIN nurseries n ON n.id = o.nursery_id
      WHERE ${where}
      ORDER BY o.created_at DESC, o.id
      LIMIT ${limit} OFFSET ${offset}`)
  ).rows;

export const findOrder = async (db: DbOrTx, id: string): Promise<OrderRow | undefined> => (await selectOrders(db, sql`o.id = ${id}`, 1, 0))[0];

export const findOrderByShortCode = async (db: DbOrTx, shortCode: string): Promise<OrderRow | undefined> =>
  (await selectOrders(db, sql`o.short_code = ${shortCode}`, 1, 0))[0];

export const listOrdersForUser = (db: DbOrTx, userId: string, limit: number, offset: number) =>
  selectOrders(db, sql`o.user_id = ${userId}`, limit, offset);

export const listOrders = (db: DbOrTx, status: OrderStatus | undefined, limit: number, offset: number) =>
  selectOrders(db, status ? sql`o.status = ${status}` : sql`true`, limit, offset);

/** Orders dispatched more than `hours` ago that the buyer never confirmed. */
export const staleDispatchedOrders = async (db: DbOrTx, hours: number): Promise<string[]> =>
  (
    await db.execute<{ id: string }>(sql`
      SELECT id FROM orders WHERE status = 'dispatched' AND dispatched_at < now() - make_interval(hours => ${hours})
      ORDER BY dispatched_at LIMIT 200`)
  ).rows.map(r => r.id);

/** The buyer's own (verified) number: trial orders record their confirmation against it. */
export const buyerPhone = async (db: DbOrTx, userId: string): Promise<string | undefined> =>
  (await db.execute<{ phone: string }>(sql`SELECT phone FROM users WHERE id = ${userId}`)).rows[0]?.phone;

