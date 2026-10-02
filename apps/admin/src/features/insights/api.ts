import { unwrap, type Schemas } from '@nurserylink/api-client';
import type { AnalyticsRange } from '@nurserylink/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type Analytics = Schemas['Analytics'];

export const useAnalytics = (range: AnalyticsRange) =>
  useQuery({
    queryKey: ['admin', 'analytics', range],
    queryFn: async () => (await unwrap(api.GET('/admin/analytics', { params: { query: { range } } }))).data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
