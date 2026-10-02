import { CloudOff } from 'lucide-react';
import { formatAge } from '@nurserylink/ui';
import { en } from '../copy/en';

/** Shown above data the service worker served from its cache because the network failed (SRS 2.6). */
export const CachedNote = ({ fromCache, fetchedAt }: { fromCache: boolean; fetchedAt: Date | null }) => {
  if (!fromCache) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-sm bg-amber-tint px-3 py-2 text-sm text-amber ring-1 ring-amber">
      <CloudOff aria-hidden className="size-4 shrink-0" />
      {fetchedAt ? en.offline.cachedNote(formatAge(fetchedAt.toISOString())) : en.offline.cachedNoteUnknown}
    </p>
  );
};
