import { Badge, EmptyState, ErrorState, SkeletonList, cn, formatDistance } from '@nurserylink/ui';
import { isApiError } from '@nurserylink/api-client';
import { ChevronRight, Gift } from 'lucide-react';
import { en } from '../../copy/en';
import type { DistanceMode } from './api';

export interface ListNursery {
  id: string;
  name: string;
  subCounty: string;
  hasCampaign: boolean;
  /** Invented sample nursery */
  isDemo: boolean;
  speciesCount: number;
  /** Road distance when known, else straight line (then marked approx.) */
  km: number | null;
  distanceMode: DistanceMode;
}

const Row = ({ n, selected, onOpen }: { n: ListNursery; selected: boolean; onOpen: (id: string) => void }) => (
  <li>
    <button
      type="button"
      onClick={() => { onOpen(n.id); }}
      aria-current={selected || undefined}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-md px-3 py-3 text-left ring-1 transition-colors',
        selected ? 'bg-forest-tint ring-forest' : 'bg-paper ring-line hover:ring-forest'
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 font-bold text-canopy">
          {n.name}
          {n.isDemo && <span className="rounded-full bg-amber-tint px-2 py-0.5 text-xs font-bold text-amber">{en.nurseries.sample}</span>}
        </span>
        <span className="text-sm text-bark-muted">
          {[n.subCounty, n.km !== null ? formatDistance(n.km, n.distanceMode) : null, en.nurseries.speciesCount(n.speciesCount)].filter(Boolean).join(' · ')}
        </span>
        {n.hasCampaign && (
          <Badge tone="gift" className="self-start">
            <Gift aria-hidden />
            {en.nurseries.freeSeedlings}
          </Badge>
        )}
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-forest" />
    </button>
  </li>
);

/** The list beside (or under) the map; every state has a message and a next step. */
export const NurseryList = ({ items, loading, error, onRetry, selectedId, onOpen, onClearFilters, heading }: {
  items: ListNursery[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onClearFilters: () => void;
  heading: string;
}) => {
  if (loading && !items) return <SkeletonList rows={6} label={en.nurseries.title} />;
  if (error && !items) {
    const offline = isApiError(error) && error.isOffline;
    return (
      <ErrorState title={offline ? en.states.offlineNoCache : en.nurseries.loadFailed} offline={offline} onRetry={onRetry} retryLabel={en.states.retry}>
        {en.states.loadFailedHelp}
      </ErrorState>
    );
  }
  if (!items || items.length === 0) {
    return (
      <EmptyState
        title={en.nurseries.emptyTitle}
        action={<button type="button" className="min-h-11 font-bold text-forest underline" onClick={onClearFilters}>{en.nurseries.clearFilters}</button>}
      >
        {en.nurseries.emptyBody}
      </EmptyState>
    );
  }
  return (
    <section aria-label={heading} className="flex flex-col gap-2">
      <h2 className="text-base font-bold text-bark" aria-live="polite">{heading}</h2>
      <ul className="flex flex-col gap-2">
        {items.map(n => <Row key={n.id} n={n} selected={n.id === selectedId} onOpen={onOpen} />)}
      </ul>
    </section>
  );
};
