import { SkeletonList } from '@nurserylink/ui';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../lib/session';

/** Every console page: signed-in administrators only. */
export const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const { user, restoring } = useSession();
  const location = useLocation();
  if (restoring) return <div className="p-6"><SkeletonList rows={4} /></div>;
  if (user?.role !== 'admin') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace state={{ notAdmin: Boolean(user) }} />;
  }
  return <>{children}</>;
};
