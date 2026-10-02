import { Field, Select, cn } from '@nurserylink/ui';
import { LocateFixed } from 'lucide-react';
import { SearchBox } from '../../components/SearchBox';
import { en } from '../../copy/en';
import { useDistricts, useSubCounties } from './api';
import type { NurseryParams, ParamUpdate } from './params';

/** District → Sub-county: the sub-county list loads for the chosen district only (FR-07). */
export const BoundaryFilters = ({ district, subCounty, onChange }: { district: string | null; subCounty: string | null; onChange: (u: ParamUpdate) => void }) => {
  const districts = useDistricts();
  const subCounties = useSubCounties(district);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={en.nurseries.district}>
        {({ id }) => (
          <Select id={id} value={district ?? ''} onChange={e => { onChange({ district: e.target.value || null }); }} disabled={districts.isPending && !districts.data}>
            <option value="">{en.nurseries.allDistricts}</option>
            {districts.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        )}
      </Field>
      <Field label={en.nurseries.subCounty}>
        {({ id }) => (
          <Select id={id} value={subCounty ?? ''} onChange={e => { onChange({ subCounty: e.target.value || null }); }} disabled={!district}>
            <option value="">{district ? en.nurseries.allSubCounties : en.nurseries.chooseDistrictFirst}</option>
            {subCounties.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
      </Field>
    </div>
  );
};

/** "Sort by nearest" as a toggle button (asks for the location the first time). */
export const NearestToggle = ({ on, busy, onToggle }: { on: boolean; busy: boolean; onToggle: () => void }) => (
  <button
    type="button"
    aria-pressed={on}
    aria-busy={busy || undefined}
    onClick={onToggle}
    className={cn(
      'flex min-h-11 items-center gap-2 rounded-full px-4 font-bold ring-1 transition-colors',
      on ? 'bg-forest text-paper ring-forest' : 'bg-paper text-forest ring-field hover:bg-forest-tint'
    )}
  >
    <LocateFixed aria-hidden className="size-5" />
    {busy ? en.location.finding : en.nurseries.sortNearest}
  </button>
);

export const FilterPanel = ({ params, update, onNearest, findingLocation, showSearch = true }: {
  params: NurseryParams;
  update: (u: ParamUpdate, o?: { replace?: boolean }) => void;
  onNearest: () => void;
  findingLocation: boolean;
  showSearch?: boolean;
}) => (
  <div className="flex flex-col gap-3">
    {showSearch && <SearchBox value={params.q} onChange={q => { update({ q }, { replace: true }); }} />}
    <BoundaryFilters district={params.district} subCounty={params.subCounty} onChange={u => { update(u); }} />
    <div className="flex flex-wrap items-center gap-2">
      <NearestToggle on={params.sort === 'nearest'} busy={findingLocation} onToggle={onNearest} />
    </div>
  </div>
);

export { SearchBox };
