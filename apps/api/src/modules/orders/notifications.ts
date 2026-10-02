import type { Config } from '../../config.js';
import type { JobQueue } from '../../jobs/queue.js';
import { orderMapUrl } from './orderMapLink.js';
import type { OrderRow } from './orders.repo.js';

const ugx = (amount: number) => `UGX ${amount.toLocaleString('en-UG')}`;

/** "200 Mvule, 150 Musizi" */
export const itemsSummary = (items: OrderRow['items']): string => items.map(i => `${String(i.quantity)} ${i.common_name}`).join(', ');

/**
 * The order SMS to the nursery, exactly as specified. It carries a link to the order map rather
 * than coordinates, and nothing beyond these fields.
 */
export const nurseryOrderSms = (order: OrderRow, mapUrl: string): string =>
  `NurseryLink order ${order.short_code}: ${itemsSummary(order.items)}. Buyer ${order.buyer_name} ${order.buyer_phone}. ` +
  `Map: ${mapUrl}. Reply ${order.short_code} 1=dispatched 2=out of stock`;

/** Composes order messages and hands them to the SMS job, which retries with backoff. */
export class OrderNotifications {
  constructor(private readonly deps: { queue: JobQueue; config: Config }) {}

  private send(to: string, message: string, orderId: string) {
    return this.deps.queue.send('sms-send', { to, message, orderId });
  }

  async paymentReceived(order: OrderRow): Promise<void> {
    const mapUrl = orderMapUrl(this.deps.config.PUBLIC_WEB_URL, this.deps.config.OTP_HMAC_SECRET, order.short_code);
    // Sample nurseries have placeholder numbers that may belong to someone: never text them
    if (!order.nursery_is_demo) await this.send(order.nursery_contact_phone, nurseryOrderSms(order, mapUrl), order.id);
    await this.send(order.buyer_phone, `NurseryLink: we have received ${ugx(order.grand_total)} for order ${order.short_code}. It is held safely until you confirm delivery.`, order.id);
  }

  async dispatched(order: OrderRow): Promise<void> {
    await this.send(order.buyer_phone, `NurseryLink order ${order.short_code} is on its way from ${order.nursery_name}. Confirm delivery in the app once you have checked your seedlings.`, order.id);
  }

  async outOfStock(order: OrderRow): Promise<void> {
    await this.send(order.buyer_phone, `NurseryLink order ${order.short_code}: ${order.nursery_name} reported it is out of stock. Our team will contact you about a refund.`, order.id);
  }

  async released(order: OrderRow, amount: number): Promise<void> {
    if (order.nursery_is_demo) return;
    await this.send(order.nursery_payout_phone, `NurseryLink order ${order.short_code}: ${ugx(amount)} has been sent to your mobile money.`, order.id);
  }

  async refunded(order: OrderRow, amount: number, msisdn: string): Promise<void> {
    await this.send(msisdn, `NurseryLink order ${order.short_code}: ${ugx(amount)} has been refunded to your mobile money.`, order.id);
  }
}
