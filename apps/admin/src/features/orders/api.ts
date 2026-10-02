import { unwrap, type Schemas } from '@nurserylink/api-client';
import type { AdminOrderAction, OrderStatus } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type AdminOrder = Schemas['AdminOrder'];
export type AuditEntry = Schemas['AuditEntry'];
export type Payout = Schemas['Payout'];

export const useAdminOrders = (status: OrderStatus | null, page: number) =>
  useQuery({
    queryKey: ['admin', 'orders', status, page],
    queryFn: async () => unwrap(api.GET('/admin/orders', { params: { query: { page, limit: 25, ...(status ? { status } : {}) } } })),
    placeholderData: keepPreviousData,
  });

export const useAdminOrder = (id: string) =>
  useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: async () => (await unwrap(api.GET('/admin/orders/{id}', { params: { path: { id } } }))).data,
    // Refunds and releases finish when the provider confirms: keep checking while one is in flight
    refetchInterval: q => (q.state.data && ['disputed', 'delivered'].includes(q.state.data.status) ? 10_000 : false),
  });

export const useOrderHistory = (id: string) =>
  useQuery({
    queryKey: ['admin', 'order-history', id],
    queryFn: async () => (await unwrap(api.GET('/admin/audit-log', { params: { query: { entity: 'order', entity_id: id, limit: 100 } } }))).data,
  });

export const useOrderAction = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ status, reason }: { status: AdminOrderAction; reason: string }) =>
      (await unwrap(api.PUT('/admin/orders/{id}/status', { params: { path: { id } }, body: { status, reason } }))).data,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

export const usePayouts = (status: Payout['status'] | null, page: number) =>
  useQuery({
    queryKey: ['admin', 'payouts', status, page],
    queryFn: async () => unwrap(api.GET('/admin/payouts', { params: { query: { page, limit: 25, ...(status ? { status } : {}) } } })),
    placeholderData: keepPreviousData,
  });

export const useRetryPayout = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await unwrap(api.POST('/admin/payouts/{id}/retry', { params: { path: { id } } }))).data,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};
