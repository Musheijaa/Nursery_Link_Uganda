import { unwrap } from '@nurserylink/api-client';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

/**
 * What needs attention. Shared by the dashboard and the sidebar's order count, so new orders show
 * up within half a minute (and as soon as the admin comes back to the tab).
 */
export const useDashboard = () =>
  useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => (await unwrap(api.GET('/admin/dashboard', {}))).data,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
