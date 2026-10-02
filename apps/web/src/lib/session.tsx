import { expectOk, type PublicUser, type SessionState } from '@nurserylink/api-client';
import { useSyncExternalStore } from 'react';
import { api, queryClient, session } from './api';

export const useSession = (): SessionState => useSyncExternalStore(cb => session.subscribe(cb), () => session.snapshot, () => session.snapshot);

export const useUser = (): PublicUser | null => useSession().user;

/** On start-up, sign back in silently if the browser still has a valid refresh cookie. */
export const restoreSession = async (): Promise<void> => {
  // A network failure here just leaves the visitor signed out; pages that need an account will ask
  await session.refresh().catch((err: unknown) => {
    console.warn('Could not restore the session', err);
    session.signOut();
  });
};

export const signOut = async (): Promise<void> => {
  // Even if the request fails (e.g. offline), the local session is cleared below
  await expectOk(api.POST('/auth/logout', {})).catch((err: unknown) => {
    console.warn('Sign-out request failed; signing out on this device only', err);
  });
  session.signOut();
  // Drop every cached personal answer (orders, applications)
  queryClient.removeQueries({ predicate: q => q.queryKey[0] === 'me' });
};
