import { expectOk, type SessionState } from '@nurserylink/api-client';
import { useSyncExternalStore } from 'react';
import { api, queryClient, session } from './api';

export const useSession = (): SessionState => useSyncExternalStore(cb => session.subscribe(cb), () => session.snapshot, () => session.snapshot);

export const restoreSession = async (): Promise<void> => {
  await session.refresh().catch((err: unknown) => {
    console.warn('Could not restore the session', err);
    session.signOut();
  });
};

export const signOut = async (): Promise<void> => {
  await expectOk(api.POST('/auth/logout', {})).catch((err: unknown) => {
    console.warn('Sign-out request failed; signing out on this device only', err);
  });
  session.signOut();
  queryClient.clear();
};
