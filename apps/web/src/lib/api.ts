import { createApiClient, isApiError } from '@nurserylink/api-client';
import { QueryClient } from '@tanstack/react-query';

/** The single API client. VITE_API_URL is empty in development: the Vite server proxies /api. */
export const { client: api, session } = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? '' });

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Try the request even when the browser says it's offline: the service worker may answer from its cache
      networkMode: 'offlineFirst',
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      // Retry only what a retry can fix: dropped connections and server errors, not 4xx answers
      retry: (failures, error) => isApiError(error) && (error.isOffline || error.status >= 500) && failures < 2,
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: { networkMode: 'online', retry: false },
  },
});
