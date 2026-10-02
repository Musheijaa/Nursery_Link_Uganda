import { z } from 'zod';
import { deliveryTypeSchema, mobileMoneyMethodSchema, orderStatusSchema } from '../enums.js';
import { ugandaPhoneSchema } from '../phone.js';
import { latLngSchema } from './admin.js';

export const quoteRequestSchema = z
  .object({
    nursery_id: z.uuid(),
    items: z
      .array(z.object({ inventory_id: z.uuid(), quantity: z.number().int().min(1).max(1_000_000) }))
      .min(1, 'Add at least one item')
      .max(50),
    delivery_type: deliveryTypeSchema,
    delivery_point: latLngSchema.optional(),
  })
  .refine(q => q.delivery_type === 'self_pickup' || q.delivery_point !== undefined, {
    message: 'Choose where the seedlings should be delivered',
    path: ['delivery_point'],
  });
export type QuoteRequest = z.input<typeof quoteRequestSchema>;

export const createOrderSchema = z.object({
  quote_token: z.string().min(20).max(4000),
  /** Required for order_and_deliver (FR-25) */
  delivery_address: z.string().trim().max(300).optional(),
  /** Required while payments are on (PAYMENTS=on); ignored while they are off (trial orders) */
  payment_method: mobileMoneyMethodSchema.optional(),
  /** The mobile money number that will approve the payment (required while payments are on) */
  payer_phone: ugandaPhoneSchema.optional(),
});
export type CreateOrderRequest = z.input<typeof createOrderSchema>;

export const adminOrderStatusSchema = z.object({
  status: z.enum(['dispatched', 'refunded', 'released']),
  reason: z.string().trim().min(5, 'Record why you are changing this order').max(500),
});

export const adminRefundSchema = z.object({
  reason: z.string().trim().min(5, 'Record why you are refunding this order').max(500),
});

export const adminOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  /** Only this nursery's orders */
  nursery_id: z.uuid().optional(),
  /** Only this buyer's orders */
  buyer_id: z.uuid().optional(),
  /** Order code, or part of the buyer's name or phone number */
  q: z.string().trim().min(1).max(100).optional(),
});
