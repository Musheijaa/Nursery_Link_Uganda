import { unwrap, type Schemas } from '@nurserylink/api-client';
import type { DeliveryType, MobileMoneyMethod } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { LatLng } from '../../lib/geo';

export type Order = Schemas['Order'];
export type Quote = Schemas['Quote'];

/** Which payment methods work right now (Airtel Money is not live yet). */
const health = { queryKey: ['health'], queryFn: async () => (await unwrap(api.GET('/health', {}))).data, staleTime: 5 * 60_000 };

/** Which mobile money methods buyers can use right now. */
export const usePaymentMethods = () => useQuery({ ...health, select: d => d.payment_methods });

/** The trial switches: while off, no SMS code at sign-up and no payment step at checkout. */
export const useFeatures = () => useQuery({ ...health, select: d => d.features });

export interface QuoteInput {
  nurseryId: string;
  items: { inventory_id: string; quantity: number }[];
  deliveryType: DeliveryType;
  point: LatLng | null;
}

/**
 * A price from the API for exactly these choices. Held for 10 minutes; the checkout re-quotes
 * when it expires or when something changes.
 */
export const useQuote = (input: QuoteInput, enabled: boolean) =>
  useQuery({
    queryKey: ['quote', input],
    enabled,
    queryFn: async () =>
      (
        await unwrap(
          api.POST('/orders/quote', {
            body: {
              nursery_id: input.nurseryId,
              items: input.items,
              delivery_type: input.deliveryType,
              ...(input.deliveryType === 'order_and_deliver' && input.point ? { delivery_point: input.point } : {}),
            },
          })
        )
      ).data,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    placeholderData: keepPreviousData,
  });

export const usePlaceOrder = () =>
  useMutation({
    mutationFn: async (body: { quote_token: string; delivery_address?: string; payment_method?: MobileMoneyMethod; payer_phone?: string }) =>
      (await unwrap(api.POST('/orders', { body }))).data,
  });

/** One order; polls every 3 s while waiting for the buyer to approve the payment. */
export const useOrder = (id: string) =>
  useQuery({
    queryKey: ['me', 'order', id],
    queryFn: async () => (await unwrap(api.GET('/orders/{id}', { params: { path: { id } } }))).data,
    refetchInterval: q => (q.state.data?.status === 'pending_payment' ? 3000 : false),
    refetchOnWindowFocus: true,
  });

export const useMyOrders = (page: number) =>
  useQuery({
    queryKey: ['me', 'orders', page],
    queryFn: async () => unwrap(api.GET('/orders/me', { params: { query: { page, limit: 10 } } })),
    placeholderData: keepPreviousData,
  });

export const useConfirmDelivery = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => (await unwrap(api.PUT('/orders/{id}/confirm-delivery', { params: { path: { id } } }))).data,
    onSuccess: order => {
      client.setQueryData(['me', 'order', id], order);
      void client.invalidateQueries({ queryKey: ['me', 'orders'] });
    },
  });
};

export const useOrderMap = (code: string, key: string) =>
  useQuery({
    queryKey: ['order-map', code, key],
    enabled: key.length > 0,
    queryFn: async () => (await unwrap(api.GET('/orders/by-code/{code}', { params: { path: { code }, query: { k: key } } }))).data,
    retry: false,
  });
