import { isApiError } from '@nurserylink/api-client';
import { giveawayStatuses, type GiveawayStatus } from '@nurserylink/shared';
import { EmptyState, ErrorState, Field, Select, SkeletonList, cn } from '@nurserylink/ui';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { CachedNote } from '../components/CachedNote';
import { ContentHero } from '../components/ContentHero';
import { SearchBox } from '../components/SearchBox';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useAllSubCounties, useGiveaways } from '../features/giveaways/api';
import { GiveawayCard } from '../features/giveaways/GiveawayCard';
import { useDistricts } from '../features/nurseries/api';

const isStatus = (v: string | null): v is GiveawayStatus => giveawayStatuses.includes(v as GiveawayStatus);

/** The Giveaways directory (FR-16): free and subsidised seedlings, filtered by status, sub-county and words. */
const Giveaways = () => {
  usePageTitle(en.giveaways.title);
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const status: GiveawayStatus = isStatus(raw) ? raw : 'open';
  const subCounty = params.get('sub_county');
  const purpose = params.get('q') ?? '';
  const giveaways = useGiveaways(50, { status, subCounty, purpose });
  const subCounties = useAllSubCounties();
  const districts = useDistricts();

  const set = (key: string, value: string | null, replace = false) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace });
  };

  // Sub-counties grouped under their districts in the dropdown
  const groups = useMemo(() => {
    const names = new Map(districts.data?.map(d => [d.id, d.name]));
    const byDistrict = new Map<string, { id: string; name: string }[]>();
    for (const s of subCounties.data ?? []) {
      const district = names.get(s.parent_id ?? '') ?? '';
      byDistrict.set(district, [...(byDistrict.get(district) ?? []), { id: s.id, name: s.name }]);
    }
    return [...byDistrict.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [subCounties.data, districts.data]);

  const list = giveaways.data?.data ?? [];
  const offline = isApiError(giveaways.error) && giveaways.error.isOffline;

  return (
    <div className="flex flex-col gap-6">
      <ContentHero contentKey="giveaways.intro" photo="community-planting" focus="object-[60%_40%]" />

      <div className="flex flex-col gap-4">
        <div role="group" aria-label={en.giveaways.statusLabel} className="flex flex-wrap gap-2">
          {giveawayStatuses.map(s => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => { set('status', s === 'open' ? null : s); }}
              className={cn(
                'min-h-11 rounded-full px-4 font-bold ring-1',
                status === s ? 'bg-canopy text-paper ring-canopy' : 'bg-paper text-canopy ring-line hover:ring-canopy'
              )}
            >
              {en.giveaways.statuses[s]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <Field label={en.giveaways.subCounty}>
            {({ id }) => (
              <Select id={id} value={subCounty ?? ''} onChange={e => { set('sub_county', e.target.value || null); }}>
                <option value="">{en.giveaways.allSubCounties}</option>
                {groups.map(([district, items]) => (
                  <optgroup key={district} label={district}>
                    {items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex flex-col gap-1">
            <span className="font-bold" aria-hidden>{en.giveaways.purposeLabel}</span>
            <SearchBox id="giveaway-q" value={purpose} onChange={v => { set('q', v || null, true); }} label={en.giveaways.purposeLabel} placeholder={en.giveaways.purposePlaceholder} />
          </div>
        </div>
      </div>

      {giveaways.data && <CachedNote fromCache={giveaways.data.fromCache} fetchedAt={giveaways.data.fetchedAt} />}
      {giveaways.isPending && <SkeletonList rows={3} label={en.giveaways.title} />}
      {giveaways.isError && !giveaways.data && (
        <ErrorState title={offline ? en.states.offlineNoCache : en.giveaways.loadFailed} offline={offline} onRetry={() => { void giveaways.refetch(); }} retryLabel={en.states.retry} />
      )}
      {giveaways.data && list.length === 0 && (
        <EmptyState title={en.giveaways.emptyTitle} action={<button type="button" className="min-h-11 font-bold text-forest underline" onClick={() => { setParams(new URLSearchParams()); }}>{en.giveaways.seeOpen}</button>}>
          {en.giveaways.emptyBody}
        </EmptyState>
      )}
      {list.length > 0 && (
        <>
          <p className="text-sm text-bark-muted" aria-live="polite">{en.giveaways.count(list.length)}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(g => <li key={g.id}><GiveawayCard g={g} detailed /></li>)}
          </ul>
        </>
      )}
    </div>
  );
};
export default Giveaways;
