import { useQuery } from '@tanstack/react-query';
import {
  AdminOverview, District, ManagedNursery, Nursery, Order, PlantingGaps, SeedlingProgramme, SiteStats,
  TreeSpecies, User, Voucher, DeliveryQuote,
} from '../types';
import { api, toQuery } from './client';

// Reference data changes rarely, so it stays fresh for a while
const LONG = 5 * 60 * 1000;

export const queryKeys = {
  me: ['me'] as const,
  districts: ['districts'] as const,
  species: ['species'] as const,
  stats: ['stats'] as const,
  nurseries: (params: object) => ['nurseries', params] as const,
  nursery: (id: string, near?: string) => ['nursery', id, near] as const,
  quotes: (id: string, district: string, seedlings: number) => ['quotes', id, district, seedlings] as const,
  programmes: ['programmes'] as const,
  vouchers: ['vouchers'] as const,
  gaps: ['planting-gaps'] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  myNurseries: ['my-nurseries'] as const,
  nurseryOrders: (id: string, scope: string) => ['nursery-orders', id, scope] as const,
  health: ['health'] as const,
  admin: ['admin'] as const,
};

export const useMe = () =>
  useQuery({ queryKey: queryKeys.me, queryFn: () => api.get<{ user: User | null }>('/auth/me').then(r => r.user), staleTime: LONG });

export const useHealth = () =>
  useQuery({ queryKey: queryKeys.health, queryFn: () => api.get<{ payments: 'simulated' | 'live'; sms: string }>('/health'), staleTime: Infinity });

export const useDistricts = () =>
  useQuery({ queryKey: queryKeys.districts, queryFn: () => api.get<District[]>('/districts'), staleTime: Infinity });

export const useSpecies = () =>
  useQuery({ queryKey: queryKeys.species, queryFn: () => api.get<TreeSpecies[]>('/species'), staleTime: LONG });

export const useStats = () =>
  useQuery({ queryKey: queryKeys.stats, queryFn: () => api.get<SiteStats>('/stats'), staleTime: LONG });

export const useNurseries = (params: { species?: string | null; district?: string | null; near?: string | null }) =>
  useQuery({
    queryKey: queryKeys.nurseries(params),
    queryFn: () => api.get<Nursery[]>(`/nurseries${toQuery(params)}`),
    placeholderData: prev => prev,
  });

export const useNursery = (id: string | null, near?: string) =>
  useQuery({
    queryKey: queryKeys.nursery(id ?? '', near),
    queryFn: () => api.get<Nursery>(`/nurseries/${id}${toQuery({ near })}`),
    enabled: Boolean(id),
  });

export const useDeliveryQuotes = (nurseryId: string, district: string, seedlings: number) =>
  useQuery({
    queryKey: queryKeys.quotes(nurseryId, district, seedlings),
    queryFn: () => api.get<DeliveryQuote[]>(`/nurseries/${nurseryId}/delivery-quotes${toQuery({ district, seedlings })}`),
    enabled: Boolean(nurseryId && district && seedlings > 0),
    placeholderData: prev => prev,
  });

export const useProgrammes = () =>
  useQuery({ queryKey: queryKeys.programmes, queryFn: () => api.get<SeedlingProgramme[]>('/programmes') });

export const useVouchers = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.vouchers, queryFn: () => api.get<Voucher[]>('/vouchers'), enabled });

export const usePlantingGaps = () =>
  useQuery({ queryKey: queryKeys.gaps, queryFn: () => api.get<PlantingGaps>('/planting-gaps'), staleTime: LONG });

export const useOrders = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.orders, queryFn: () => api.get<Order[]>('/orders'), enabled });

/** Polls while the order waits for the buyer to approve the Mobile Money prompt. */
export const useOrder = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.order(id ?? ''),
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: Boolean(id),
    refetchInterval: query => (query.state.data?.status === 'awaiting_payment' ? 3000 : false),
  });

export const useMyNurseries = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.myNurseries, queryFn: () => api.get<ManagedNursery[]>('/my/nurseries'), enabled });

export const useNurseryOrders = (nurseryId: string | null, scope: 'open' | 'all') =>
  useQuery({
    queryKey: queryKeys.nurseryOrders(nurseryId ?? '', scope),
    queryFn: () => api.get<Order[]>(`/my/nurseries/${nurseryId}/orders?scope=${scope}`),
    enabled: Boolean(nurseryId),
    refetchInterval: 30_000,
  });

export const useAdminOverview = (enabled: boolean) =>
  useQuery({ queryKey: [...queryKeys.admin, 'overview'], queryFn: () => api.get<AdminOverview>('/admin/overview'), enabled });
