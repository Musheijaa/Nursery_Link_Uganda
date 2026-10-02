import { isApiError } from '@nurserylink/api-client';
import { EmptyState, ErrorState, Field, Select, SkeletonList } from '@nurserylink/ui';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { CachedNote } from '../components/CachedNote';
import { SearchBox } from '../components/SearchBox';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useAllSubCounties, useCampaigns } from '../features/campaigns/api';
import { CampaignCard } from '../features/campaigns/CampaignCard';
import { useDistricts } from '../features/nurseries/api';
import { PageHero } from '../components/PageHero';

/** The free-seedlings directory (FR-16): filter by sub-county and purpose. */
const FreeSeedlings = () => {
  usePageTitle(en.freeSeedlings.title);
  const [params, setParams] = useSearchParams();
  const subCounty = params.get('sub_county');
  const purpose = params.get('purpose') ?? '';
  const campaigns = useCampaigns(50, { subCounty, purpose });
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

  const list = campaigns.data?.data ?? [];
  const offline = isApiError(campaigns.error) && campaigns.error.isOffline;

  return (
    <div className="flex flex-col gap-5">
      <PageHero title={en.freeSeedlings.title} intro={en.freeSeedlings.intro} photo="community-planting" focus="object-[60%_40%]" />

      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <Field label={en.freeSeedlings.subCounty}>
          {({ id }) => (
            <Select id={id} value={subCounty ?? ''} onChange={e => { set('sub_county', e.target.value || null); }}>
              <option value="">{en.freeSeedlings.allSubCounties}</option>
              {groups.map(([district, items]) => (
                <optgroup key={district} label={district}>
                  {items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col gap-1">
          <span className="font-bold" aria-hidden>{en.freeSeedlings.purposeLabel}</span>
          <SearchBox id="purpose" value={purpose} onChange={v => { set('purpose', v || null, true); }} label={en.freeSeedlings.purposeLabel} placeholder={en.freeSeedlings.purposePlaceholder} />
        </div>
      </div>

      {campaigns.data && <CachedNote fromCache={campaigns.data.fromCache} fetchedAt={campaigns.data.fetchedAt} />}
      {campaigns.isPending && <SkeletonList rows={3} label={en.freeSeedlings.title} />}
      {campaigns.isError && !campaigns.data && (
        <ErrorState title={offline ? en.states.offlineNoCache : en.freeSeedlings.loadFailed} offline={offline} onRetry={() => { void campaigns.refetch(); }} retryLabel={en.states.retry} />
      )}
      {campaigns.data && list.length === 0 && (
        <EmptyState title={en.freeSeedlings.emptyTitle} action={<button type="button" className="min-h-11 font-bold text-forest underline" onClick={() => { setParams(new URLSearchParams()); }}>{en.freeSeedlings.allSubCounties}</button>}>
          {en.freeSeedlings.emptyBody}
        </EmptyState>
      )}
      {list.length > 0 && (
        <>
          <p className="text-sm text-bark-muted" aria-live="polite">{en.freeSeedlings.count(list.length)}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(c => <li key={c.id}><CampaignCard c={c} detailed /></li>)}
          </ul>
        </>
      )}
    </div>
  );
};
export default FreeSeedlings;
