import { randomInt } from 'node:crypto';
import type { Logger } from 'pino';
import { adminOrderActions, mobileMoneyNetwork, type AdminOrderAction, type DeliveryType, type OrderMapDto, type MobileMoneyMethod, type OrderStatus, type PaginationMeta, type PaymentMethod } from '@nurserylink/shared';
import type { Config } from '../../config.js';
import type { Database } from '../../db/client.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, ForbiddenError, NotFoundError, ProviderUnavailableError, ValidationError } from '../../lib/errors.js';
import type { LatLng } from '../../lib/geo.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import { pgErrorCode } from '../../middleware/errorHandler.js';
import type { RoutingProvider } from '../../providers/routing/routing.js';
import type { InboundSms } from '../../providers/sms/sms.js';
import type { PaymentProviders } from '../../providers/index.js';
import type { PaymentProvider } from '../../providers/payment/payment.js';
import { chooseDeliveryRate } from './fees.js';
import type { OrderNotifications } from './notifications.js';
import * as repo from './orders.repo.js';
import type { PaymentsService } from './payments.service.js';
import { isValidOrderMapKey } from './orderMapLink.js';
import { signQuote, verifyQuote, type QuotePayload } from './quoteToken.js';
import { parseSmsReply } from './smsReply.js';
import { transitionOrder } from './stateMachine.js';

/** Orders dispatched this long ago without confirmation are released automatically. */
export const AUTO_RELEASE_HOURS = 72;

// No 0/O or 1/I, so codes are easy to read aloud and type on a basic phone
const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newShortCode = () => Array.from({ length: 6 }, () => SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)]).join('');

export interface QuoteInput {
  nursery_id: string;
  items: { inventory_id: string; quantity: number }[];
  delivery_type: DeliveryType;
  delivery_point?: LatLng | undefined;
}

export interface CreateOrderInput {
  quote_token: string;
  delivery_address?: string | undefined;
  /** Required while payments are on; ignored while they are off (trial orders) */
  payment_method?: MobileMoneyMethod | undefined;
  payer_phone?: string | undefined;
}

export interface QuoteResult {
  nursery: { id: string; name: string };
  items: { inventory_id: string; species: { slug: string; common_name: string }; quantity: number; unit_price: number; line_total: number }[];
  items_total: number;
  delivery: { type: DeliveryType; distance_km: number | null; vehicle: string | null; base_fee: number; per_km: number; fee: number };
  grand_total: number;
  quote_token: string;
  expires_at: string;
}

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export const toOrderDto = (o: repo.OrderRow, payment?: repo.PaymentRow) => ({
  id: o.id,
  short_code: o.short_code,
  status: o.status,
  nursery: { id: o.nursery_id, name: o.nursery_name, contact_phone: o.nursery_contact_phone },
  delivery_type: o.delivery_type,
  delivery_point: o.delivery_lat === null || o.delivery_lng === null ? null : { lat: o.delivery_lat, lng: o.delivery_lng },
  delivery_address: o.delivery_address,
  distance_km: o.distance_km,
  items: o.items.map(i => ({
    inventory_id: i.inventory_id,
    species: { slug: i.slug, common_name: i.common_name },
    quantity: i.quantity,
    unit_price: i.unit_price,
    line_total: i.line_total,
  })),
  items_total: o.items_total,
  delivery_fee: o.delivery_fee,
  grand_total: o.grand_total,
  payment_method: o.payment_method,
  ...(payment ? { payment: { status: payment.status, msisdn: payment.msisdn } } : {}),
  created_at: new Date(o.created_at).toISOString(),
  paid_at: iso(o.paid_at),
  dispatched_at: iso(o.dispatched_at),
  delivered_at: iso(o.delivered_at),
  released_at: iso(o.released_at),
});
export type OrderDto = ReturnType<typeof toOrderDto>;

export interface OrdersDeps {
  db: Database;
  config: Config;
  routing: RoutingProvider;
  providers: PaymentProviders;
  payments: PaymentsService;
  notifications: OrderNotifications;
  logger: Logger;
}

export class OrdersService {
  constructor(private readonly deps: OrdersDeps) {}

  // ── Quote ────────────────────────────────────────────────

  /** Prices an order from live stock, road distance and the delivery rate table (FR-13). */
  async quote(userId: string, input: QuoteInput): Promise<QuoteResult> {
    const { db } = this.deps;
    const nursery = await repo.findActiveNursery(db, input.nursery_id);
    if (!nursery) throw new NotFoundError('Nursery not found');
    this.refuseSampleNurseryWithLivePayments(nursery);

    const lines = await this.checkedLines(input.nursery_id, input.items);
    const items = input.items.map(item => {
      const line = lines.get(item.inventory_id);
      if (!line) throw new Error('checkedLines guarantees every line');
      return { line, quantity: item.quantity, lineTotal: item.quantity * line.unit_price };
    });
    const itemsTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const seedlings = items.reduce((sum, i) => sum + i.quantity, 0);

    let delivery: QuoteResult['delivery'] = { type: input.delivery_type, distance_km: null, vehicle: null, base_fee: 0, per_km: 0, fee: 0 };
    if (input.delivery_type === 'order_and_deliver') {
      if (!input.delivery_point) throw new ValidationError('Choose where the seedlings should be delivered', { path: 'delivery_point' });
      // Delivery is priced on road distance only; if routing is down we refuse rather than guess a price
      const [km] = await this.deps.routing.table({ lat: nursery.lat, lng: nursery.lng }, [input.delivery_point]);
      if (km === null || km === undefined) throw new ValidationError('We could not find a road route to that delivery point', { path: 'delivery_point' });

      const rates = (await repo.activeRates(db)).map(r => ({ id: r.id, vehicle: r.vehicle, maxItems: r.max_items, baseFee: r.base_fee, perKm: r.per_km, maxKm: r.max_km }));
      const choice = chooseDeliveryRate(rates, seedlings, km);
      if (!choice.ok) {
        throw new ValidationError(
          choice.reason === 'too_many_items'
            ? `This order is too large to deliver in one trip (up to ${String(choice.maxItems ?? 0)} seedlings). Split it, or collect from the nursery.`
            : `This delivery point is too far for our couriers (up to ${String(choice.maxKm ?? 0)} km by road). Collect from the nursery instead.`,
          { reason: choice.reason, distance_km: km }
        );
      }
      delivery = { type: 'order_and_deliver', distance_km: km, vehicle: choice.rate.vehicle, base_fee: choice.rate.baseFee, per_km: choice.rate.perKm, fee: choice.fee };
    }

    const payload: QuotePayload = {
      user_id: userId,
      nursery_id: nursery.id,
      delivery_type: input.delivery_type,
      delivery_point: input.delivery_type === 'order_and_deliver' ? input.delivery_point ?? null : null,
      distance_km: delivery.distance_km,
      vehicle: delivery.vehicle as QuotePayload['vehicle'],
      delivery_fee: delivery.fee,
      items_total: itemsTotal,
      grand_total: itemsTotal + delivery.fee,
      items: items.map(i => ({ inventory_id: i.line.id, species_id: i.line.species_id, quantity: i.quantity, unit_price: i.line.unit_price })),
    };
    const signed = await signQuote(this.deps.config.QUOTE_TOKEN_SECRET, payload);
    return {
      nursery: { id: nursery.id, name: nursery.name },
      items: items.map(i => ({
        inventory_id: i.line.id,
        species: { slug: i.line.slug, common_name: i.line.common_name },
        quantity: i.quantity,
        unit_price: i.line.unit_price,
        line_total: i.lineTotal,
      })),
      items_total: itemsTotal,
      delivery,
      grand_total: payload.grand_total,
      quote_token: signed.token,
      expires_at: signed.expiresAt.toISOString(),
    };
  }

  /** Stock lines for a quote: all from this nursery, listed once, with enough stock. */
  private async checkedLines(nurseryId: string, items: QuoteInput['items']): Promise<Map<string, repo.StockRow>> {
    const ids = items.map(i => i.inventory_id);
    if (new Set(ids).size !== ids.length) throw new ValidationError('List each item once', { path: 'items' });
    const lines = new Map((await repo.stockLines(this.deps.db, ids)).map(l => [l.id, l]));
    const problems: { inventory_id: string; message: string; available?: number }[] = [];
    for (const item of items) {
      const line = lines.get(item.inventory_id);
      if (line?.nursery_id !== nurseryId) problems.push({ inventory_id: item.inventory_id, message: 'This nursery does not sell this item' });
      else if (item.quantity > line.quantity_available) {
        problems.push({ inventory_id: item.inventory_id, message: `Only ${String(line.quantity_available)} ${line.common_name} left`, available: line.quantity_available });
      }
    }
    if (problems.some(p => p.available === undefined)) throw new ValidationError('Some items are not available from this nursery', problems);
    if (problems.length) throw new ConflictError('Not enough stock for some items', problems);
    return lines;
  }

  // ── Place an order ───────────────────────────────────────

  /**
   * Creates an order from a quote, in one transaction: lock the stock lines, re-check prices and
   * stock against the quote, take the stock, and record the pending payment. The payment prompt
   * is sent after the transaction commits.
   */
  /**
   * Sample (demo) nurseries are invented: with real money they'd take payment for seedlings that
   * don't exist, and pay out to a placeholder number. They can only take mock or trial orders.
   */
  private refuseSampleNurseryWithLivePayments(nursery: { is_demo: boolean }) {
    if (nursery.is_demo && this.deps.config.PAYMENT_PROVIDER_MODE === 'live') {
      throw new ConflictError('This is a sample nursery for testing. It can’t take real orders.');
    }
  }

  async create(userId: string, input: CreateOrderInput): Promise<{ order: OrderDto; next_step: string }> {
    const { db, config } = this.deps;
    const { id: quoteId, quote } = await verifyQuote(config.QUOTE_TOKEN_SECRET, input.quote_token);
    if (quote.user_id !== userId) throw new ForbiddenError('This quote belongs to another account');
    const nursery = await repo.findActiveNursery(db, quote.nursery_id);
    if (nursery) this.refuseSampleNurseryWithLivePayments(nursery);

    // FR-25: nothing reaches a nursery without items, a delivery point and address, and a payment method
    const address = input.delivery_address?.trim() ?? '';
    if (quote.items.length === 0) throw new ValidationError('Add at least one item', { path: 'items' });
    if (quote.delivery_type === 'order_and_deliver' && (!quote.delivery_point || address.length < 5)) {
      throw new ValidationError('Give a delivery address (village, road or landmark)', { path: 'delivery_address' });
    }
    // Payments switched off (trial): no payment step; the order is confirmed below without taking money
    const trial = config.PAYMENTS === 'off';
    let method: PaymentMethod;
    let msisdn: string;
    let provider: PaymentProvider;
    if (trial) {
      const phone = await repo.buyerPhone(db, userId);
      if (!phone) throw new ForbiddenError('Account not found');
      method = 'trial';
      msisdn = phone;
      provider = this.deps.providers.byName('mock');
    } else {
      if (!input.payment_method) throw new ValidationError('Choose how you will pay', { path: 'payment_method' });
      if (!input.payer_phone) throw new ValidationError('Enter the mobile money number that will pay', { path: 'payer_phone' });
      const network = mobileMoneyNetwork(input.payer_phone);
      if (network && network !== input.payment_method) {
        throw new ValidationError(`${input.payer_phone} looks like an ${network === 'mtn_momo' ? 'MTN' : 'Airtel'} number; choose that payment method`, { path: 'payer_phone' });
      }
      if (!this.deps.providers.isAvailable(input.payment_method)) {
        const name = input.payment_method === 'airtel_money' ? 'Airtel Money' : 'MTN Mobile Money';
        throw new ProviderUnavailableError(`${name} payments are not available yet. Please choose another payment method.`, { path: 'payment_method' });
      }
      method = input.payment_method;
      msisdn = input.payer_phone;
      provider = this.deps.providers.forMethod(input.payment_method);
    }
    const created = await db.transaction(async tx => {
      const lines = new Map((await repo.stockLines(tx, quote.items.map(i => i.inventory_id), true)).map(l => [l.id, l]));
      const changed = quote.items.flatMap(item => {
        const line = lines.get(item.inventory_id);
        if (line?.nursery_id !== quote.nursery_id) return [{ inventory_id: item.inventory_id, reason: 'no_longer_listed' }];
        if (line.unit_price !== item.unit_price) return [{ inventory_id: item.inventory_id, reason: 'price_changed', quoted: item.unit_price, now: line.unit_price }];
        if (line.quantity_available < item.quantity) return [{ inventory_id: item.inventory_id, reason: 'not_enough_stock', requested: item.quantity, available: line.quantity_available }];
        return [];
      });
      if (changed.length) throw new ConflictError('Prices or stock have changed since your quote. Please get a new quote.', changed);

      for (const item of quote.items) await repo.decrementStock(tx, item.inventory_id, item.quantity);

      let orderId: string | undefined;
      for (let attempt = 0; attempt < 5 && !orderId; attempt++) {
        orderId = await repo.insertOrder(tx, {
          shortCode: newShortCode(),
          userId,
          nurseryId: quote.nursery_id,
          deliveryType: quote.delivery_type,
          deliveryPoint: quote.delivery_point,
          deliveryAddress: quote.delivery_type === 'order_and_deliver' ? address : null,
          distanceKm: quote.distance_km,
          deliveryFee: quote.delivery_fee,
          itemsTotal: quote.items_total,
          grandTotal: quote.grand_total,
          paymentMethod: method,
        });
      }
      if (!orderId) throw new Error('Could not allocate a unique order code');
      const newOrderId = orderId;

      for (const item of quote.items) {
        await repo.insertOrderItem(tx, { orderId: newOrderId, inventoryId: item.inventory_id, speciesId: item.species_id, quantity: item.quantity, unitPrice: item.unit_price });
      }

      let payment: repo.PaymentRow;
      try {
        // The quote id is the idempotency key, so one quote can only ever produce one order
        payment = await repo.insertPayment(tx, {
          orderId: newOrderId, kind: 'collection', provider: provider.name, msisdn, amount: quote.grand_total, idempotencyKey: quoteId,
        });
      } catch (err) {
        if (pgErrorCode(err) === '23505') throw new ConflictError('This quote has already been used to place an order.');
        throw err;
      }
      await writeAudit(tx, {
        actorId: userId, action: 'order.created', entity: 'order', entityId: newOrderId,
        after: { status: 'pending_payment', grand_total: quote.grand_total, items: quote.items, payment_method: method },
      });
      return { orderId: newOrderId, payment };
    });

    if (trial) {
      // Confirmed at once, through the normal payment path (so the nursery and buyer get their SMS)
      await this.deps.payments.applyCollectionResult(created.payment.id, { status: 'successful', reason: 'trial' });
      return {
        order: toOrderDto(await this.mustFind(created.orderId), (await repo.findPayment(db, created.payment.id)) ?? created.payment),
        next_step: 'Your order is confirmed. The nursery has been sent the details.',
      };
    }

    const order = await this.mustFind(created.orderId);
    try {
      await this.deps.payments.requestCollection(created.payment, `Nursery Link order ${order.short_code}`);
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        throw new ProviderUnavailableError('We could not reach your mobile money provider, so the order was cancelled. Please try again.', { order_id: order.id });
      }
      throw err;
    }
    return {
      order: toOrderDto(await this.mustFind(created.orderId), created.payment),
      next_step: 'Approve the payment prompt on your phone to confirm the order.',
    };
  }

  // ── The nursery's order map (link in the order SMS) ──────

  /**
   * Public, but only with the key from the SMS link. A wrong code and a wrong key both answer
   * 404, so the endpoint can't be used to find out which codes exist.
   */
  async orderMap(shortCode: string, key: string): Promise<OrderMapDto> {
    const code = shortCode.toUpperCase();
    const order = isValidOrderMapKey(this.deps.config.OTP_HMAC_SECRET, code, key) ? await repo.findOrderByShortCode(this.deps.db, code) : undefined;
    if (!order) throw new NotFoundError('Order not found');
    return {
      short_code: order.short_code,
      status: order.status,
      nursery: { name: order.nursery_name, location: { lat: order.nursery_lat, lng: order.nursery_lng } },
      delivery_type: order.delivery_type,
      delivery_point: order.delivery_lat === null || order.delivery_lng === null ? null : { lat: order.delivery_lat, lng: order.delivery_lng },
      delivery_address: order.delivery_address,
      items: order.items.map(i => ({ common_name: i.common_name, quantity: i.quantity })),
      buyer: { full_name: order.buyer_name, phone: order.buyer_phone },
      created_at: new Date(order.created_at).toISOString(),
    };
  }

  // ── Reading ──────────────────────────────────────────────

  async listMine(userId: string, page: Pagination): Promise<{ items: OrderDto[]; meta: PaginationMeta }> {
    const rows = await repo.listOrdersForUser(this.deps.db, userId, page.limit, toOffset(page));
    return { items: rows.map(o => toOrderDto(o)), meta: paginationMeta(page, rows[0]?.total ?? 0) };
  }

  /** Owner or admin only; anyone else gets 404 so order ids reveal nothing. */
  async get(viewer: { id: string; role: string }, orderId: string): Promise<OrderDto> {
    const order = await repo.findOrder(this.deps.db, orderId);
    if (!order || (order.user_id !== viewer.id && viewer.role !== 'admin')) throw new NotFoundError('Order not found');
    return toOrderDto(order, await repo.collectionForOrder(this.deps.db, orderId));
  }

  // ── Delivery and release ─────────────────────────────────

  /** The buyer confirms the seedlings arrived: the order is delivered and the nursery gets paid. */
  async confirmDelivery(userId: string, orderId: string): Promise<OrderDto> {
    const order = await repo.findOrder(this.deps.db, orderId);
    if (order?.user_id !== userId) throw new NotFoundError('Order not found');
    await this.deliverAndPay(orderId, userId, 'Buyer confirmed delivery');
    return toOrderDto(await this.mustFind(orderId));
  }

  /** Auto-release job: orders dispatched more than 72 hours ago are treated as delivered. */
  async autoRelease(): Promise<number> {
    const ids = await repo.staleDispatchedOrders(this.deps.db, AUTO_RELEASE_HOURS);
    let released = 0;
    for (const id of ids) {
      // One stuck order must not block the others; each failure is logged and retried next run
      try {
        await this.deliverAndPay(id, null, `No confirmation within ${String(AUTO_RELEASE_HOURS)} hours of dispatch`);
        released += 1;
      } catch (err) {
        this.deps.logger.error({ err, orderId: id }, 'Auto-release failed for order');
      }
    }
    return released;
  }

  private async deliverAndPay(orderId: string, actorId: string | null, reason: string) {
    const payout = await this.deps.db.transaction(async tx => {
      await transitionOrder(tx, orderId, 'delivered', { actorId, reason, from: ['dispatched'] });
      return this.deps.payments.createNurseryPayout(tx, orderId);
    });
    await this.deps.payments.startPayout(payout.id);
  }

  // ── Nursery SMS replies ──────────────────────────────────

  /**
   * "<code> 1" marks the order dispatched; "<code> 2" (out of stock) disputes it for an admin.
   * Replies must come from the nursery's own phone. Anything else is logged for an admin.
   */
  async handleNurseryReply(sms: InboundSms): Promise<'dispatched' | 'disputed' | 'ignored'> {
    const { db } = this.deps;
    const reply = parseSmsReply(sms.text);
    const order = reply.kind === 'unrecognised' ? undefined : await repo.findOrderByShortCode(db, reply.shortCode);
    const fromNursery = order && [order.nursery_contact_phone, order.nursery_payout_phone].includes(sms.from);

    if (reply.kind === 'unrecognised' || !order || !fromNursery) {
      const reason = reply.kind === 'unrecognised' ? 'unrecognised text' : !order ? 'unknown order code' : 'sender is not the nursery';
      await writeAudit(db, { actorId: null, action: 'sms.unrecognised', entity: 'sms', entityId: order?.id ?? null, after: { from: sms.from, text: sms.text, reason } });
      return 'ignored';
    }

    const to: OrderStatus = reply.kind === 'dispatched' ? 'dispatched' : 'disputed';
    try {
      await db.transaction(async tx => {
        await transitionOrder(tx, order.id, to, {
          actorId: null,
          reason: reply.kind === 'dispatched' ? 'Nursery replied 1 (dispatched)' : 'Nursery replied 2 (out of stock)',
          from: ['escrow_held'],
        });
        if (to === 'disputed') {
          await writeAudit(tx, { actorId: null, action: 'order.flagged', entity: 'order', entityId: order.id, after: { reason: 'Nursery reported out of stock', from: sms.from } });
        }
      });
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      // e.g. a repeated "1" after the order was already dispatched
      await writeAudit(db, { actorId: null, action: 'sms.unrecognised', entity: 'sms', entityId: order.id, after: { from: sms.from, text: sms.text, reason: `order is ${order.status}` } });
      return 'ignored';
    }

    const updated = await this.mustFind(order.id);
    if (to === 'dispatched') await this.deps.notifications.dispatched(updated);
    else await this.deps.notifications.outOfStock(updated);
    return to;
  }

  // ── Admin actions ────────────────────────────────────────

  /** One order with the buyer's details and the collection payment, for the admin order page. */
  async adminGet(orderId: string) {
    const o = await this.mustFind(orderId);
    return { ...toOrderDto(o, await repo.collectionForOrder(this.deps.db, orderId)), buyer: { id: o.user_id, full_name: o.buyer_name, phone: o.buyer_phone } };
  }

  async adminList(status: OrderStatus | undefined, page: Pagination) {
    const rows = await repo.listOrders(this.deps.db, status, page.limit, toOffset(page));
    return {
      items: rows.map(o => ({ ...toOrderDto(o), buyer: { id: o.user_id, full_name: o.buyer_name, phone: o.buyer_phone } })),
      meta: paginationMeta(page, rows[0]?.total ?? 0),
    };
  }

  /**
   * Admin status change with a required reason:
   *  - dispatched: from escrow_held or disputed;
   *  - refunded: the order is disputed first, then refunded once the refund payment succeeds;
   *  - released: pays the nursery; the order becomes released once the payout succeeds.
   */
  async adminSetStatus(actorId: string, orderId: string, target: AdminOrderAction, reason: string): Promise<OrderDto> {
    const { db } = this.deps;
    const current = await this.mustFind(orderId);
    // The same rule the admin console uses to show its buttons
    if (!adminOrderActions(current.status).includes(target)) {
      throw new ConflictError(`An order that is ${current.status.replace(/_/g, ' ')} cannot be ${target === 'dispatched' ? 'dispatched' : target}`, { from: current.status, to: target });
    }

    if (target === 'dispatched') {
      await db.transaction(tx => transitionOrder(tx, orderId, 'dispatched', { actorId, reason, from: ['escrow_held', 'disputed'] }));
      await this.deps.notifications.dispatched(await this.mustFind(orderId));
    } else if (target === 'refunded') {
      const refund = await db.transaction(async tx => {
        const order = await this.mustFind(orderId);
        if (order.status === 'escrow_held' || order.status === 'dispatched') {
          await transitionOrder(tx, orderId, 'disputed', { actorId, reason: `Refund requested: ${reason}` });
        } else if (order.status !== 'disputed') {
          throw new ConflictError(`An order that is ${order.status.replace(/_/g, ' ')} cannot be refunded`);
        }
        const payment = await this.deps.payments.createRefund(tx, orderId);
        await writeAudit(tx, { actorId, action: 'order.refund_requested', entity: 'order', entityId: orderId, after: { reason, payment_id: payment.id, amount: payment.amount } });
        return payment;
      });
      await this.deps.payments.startPayout(refund.id);
    } else {
      const payout = await db.transaction(async tx => {
        const order = await this.mustFind(orderId);
        if (order.status === 'dispatched') await transitionOrder(tx, orderId, 'delivered', { actorId, reason });
        else if (order.status !== 'delivered' && order.status !== 'disputed') {
          throw new ConflictError(`An order that is ${order.status.replace(/_/g, ' ')} cannot be released`);
        }
        const payment = await this.deps.payments.createNurseryPayout(tx, orderId);
        await writeAudit(tx, { actorId, action: 'order.release_requested', entity: 'order', entityId: orderId, after: { reason, payment_id: payment.id, amount: payment.amount } });
        return payment;
      });
      await this.deps.payments.startPayout(payout.id);
    }
    return toOrderDto(await this.mustFind(orderId));
  }

  /** Admin retry of a failed payout or refund (including after the automatic attempts ran out). */
  async adminRetryPayout(actorId: string, paymentId: string) {
    const retry = await this.deps.db.transaction(async tx => {
      const failed = await repo.findPayment(tx, paymentId, true);
      if (!failed || failed.kind === 'collection') throw new NotFoundError('Payout not found');
      if (failed.status !== 'failed') throw new ConflictError('Only failed payouts can be retried');
      const newer = (await repo.payoutsForOrder(tx, failed.order_id)).filter(p => p.kind === failed.kind && p.status !== 'failed');
      if (newer.length) throw new ConflictError('A newer attempt for this payout is already pending or paid');
      const payment = await repo.insertPayment(tx, { orderId: failed.order_id, kind: failed.kind, provider: failed.provider, msisdn: failed.msisdn, amount: failed.amount });
      await writeAudit(tx, { actorId, action: 'payout.retry', entity: 'payment', entityId: payment.id, after: { previous_payment_id: failed.id, kind: failed.kind } });
      return payment;
    });
    await this.deps.payments.startPayout(retry.id);
    const payment = await repo.findPayment(this.deps.db, retry.id);
    return { id: retry.id, status: payment?.status ?? 'pending' };
  }

  async adminListPayouts(status: repo.PaymentRow['status'] | undefined, page: Pagination) {
    const rows = await repo.listPayouts(this.deps.db, status, page.limit, toOffset(page));
    return {
      items: rows.map(({ total: _total, created_at, updated_at, ...p }) => ({
        ...p,
        created_at: new Date(created_at).toISOString(),
        updated_at: new Date(updated_at).toISOString(),
      })),
      meta: paginationMeta(page, rows[0]?.total ?? 0),
    };
  }

  private async mustFind(orderId: string): Promise<repo.OrderRow> {
    const order = await repo.findOrder(this.deps.db, orderId);
    if (!order) throw new NotFoundError('Order not found');
    return order;
  }
}
