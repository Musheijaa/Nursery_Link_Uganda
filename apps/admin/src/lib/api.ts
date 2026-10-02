import { createApiClient, isApiError } from '@nurserylink/api-client';
import { QueryClient } from '@tanstack/react-query';

export const { client: api, session } = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? '', app: 'admin' });

export const queryClient = new QueryClient({
  defaultOptions: {
    // Admins work with live data: short freshness, refetch when returning to the tab
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (failures, error) => isApiError(error) && (error.isOffline || error.status >= 500) && failures < 2,
    },
    mutations: { retry: false },
  },
});
