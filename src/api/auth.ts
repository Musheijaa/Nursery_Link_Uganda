import { useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './hooks';

/** Signs out and clears every cached query so no private data lingers. */
export const useSignOut = () => {
  const queryClient = useQueryClient();
  return async () => {
    await api.post('/auth/logout');
    queryClient.setQueryData(queryKeys.me, null);
    queryClient.removeQueries({ predicate: q => q.queryKey[0] !== 'me' });
  };
};
