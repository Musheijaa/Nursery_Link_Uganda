import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** A placeholder block shown while data loads (lists use skeletons, not spinners). */
export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div aria-hidden className={cn('animate-pulse rounded-sm bg-line/70 motion-reduce:animate-none', className)} {...props} />
);

/** n skeleton rows shaped like list items, announced once as loading. */
export const SkeletonList = ({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) => (
  <div role="status" aria-label={label} className="flex flex-col gap-3">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex flex-col gap-2 rounded-lg bg-paper shadow-card p-4 ring-1 ring-line">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    ))}
  </div>
);
