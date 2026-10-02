import type { Logger } from 'pino';
import type { OrdersService } from '../modules/orders/orders.service.js';

/** Orders dispatched more than 72 hours ago without the buyer confirming are delivered and paid out. */
export const autoRelease = (orders: OrdersService, logger: Logger) => async () => {
  const released = await orders.autoRelease();
  if (released > 0) logger.info({ released }, 'Auto-released unconfirmed dispatched orders');
};
