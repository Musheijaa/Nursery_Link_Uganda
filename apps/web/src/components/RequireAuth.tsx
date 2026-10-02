import { SkeletonList } from '@nurserylink/ui';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../lib/session';

/** Buyer-only pages: visitors go to sign in, then come back to where they were. */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, restoring } = useSession();
  const location = useLocation();
  if (restoring) return <SkeletonList rows={3} />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace state={{ reason: 'auth' }} />;
  return <>{children}</>;
};
