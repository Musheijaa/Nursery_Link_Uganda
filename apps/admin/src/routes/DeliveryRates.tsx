import { unwrap, expectOk, type Schemas } from '@nurserylink/api-client';
import { vehicles } from '@nurserylink/shared';
import { Button, ErrorState, Select, SkeletonList, formatUGX, toast } from '@nurserylink/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { api } from '../lib/api';
import { toastError } from '../lib/errors';

type Rate = Schemas['DeliveryRate'];
type Draft = { vehicle: Rate['vehicle']; max_items: string; base_fee: string; per_km: string; max_km: string; active: boolean };

const toDraft = (r: Rate): Draft => ({ vehicle: r.vehicle, max_items: String(r.max_items), base_fee: String(r.base_fee), per_km: String(r.per_km), max_km: String(r.max_km), active: r.active });
const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : NaN);
const parse = (d: Draft) => ({ vehicle: d.vehicle, max_items: num(d.max_items), base_fee: num(d.base_fee), per_km: num(d.per_km), max_km: num(d.max_km), active: d.active });
const valid = (d: Draft) => Object.values(parse(d)).every(v => typeof v !== 'number' || Number.isFinite(v));

const cell = 'h-9 w-28 rounded-sm border border-field bg-paper px-2 text-right text-sm tabular-nums';

const RateRow = ({ draft, onChange, actions, label }: { draft: Draft; onChange: (d: Draft) => void; actions: ReactNode; label: string }) => {
  const p = parse(draft);
  return (
    <tr>
      <td className="border-b border-line px-3 py-1">
        <Select aria-label={`${en.rates.columns.vehicle}: ${label}`} className="min-h-9 min-w-44 text-sm" value={draft.vehicle} onChange={e => { onChange({ ...draft, vehicle: e.target.value as Rate['vehicle'] }); }}>
          {vehicles.map(v => <option key={v} value={v}>{en.rates.vehicles[v]}</option>)}
        </Select>
      </td>
      {(['max_items', 'base_fee', 'per_km', 'max_km'] as const).map(k => (
        <td key={k} className="border-b border-line px-3">
          <input aria-label={`${en.rates.columns[k === 'max_items' ? 'maxItems' : k === 'base_fee' ? 'base' : k === 'per_km' ? 'perKm' : 'maxKm']}: ${label}`} className={cell} inputMode="numeric" value={draft[k]} onChange={e => { onChange({ ...draft, [k]: e.target.value }); }} />
        </td>
      ))}
      <td className="border-b border-line px-3 text-center">
        <input type="checkbox" aria-label={`${en.rates.columns.active}: ${label}`} className="size-5 accent-forest" checked={draft.active} onChange={e => { onChange({ ...draft, active: e.target.checked }); }} />
      </td>
      <td className="border-b border-line px-3 text-sm whitespace-nowrap text-bark-muted">{Number.isFinite(p.base_fee) && Number.isFinite(p.per_km) ? en.rates.example(formatUGX(p.base_fee + 10 * p.per_km)) : ''}</td>
      <td className="border-b border-line px-3">{actions}</td>
    </tr>
  );
};

const Existing = ({ rate }: { rate: Rate }) => {
  const client = useQueryClient();
  const [draft, setDraft] = useState(() => toDraft(rate));
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(rate));
  const save = useMutation({ mutationFn: async () => unwrap(api.PATCH('/admin/delivery-rates/{id}', { params: { path: { id: rate.id } }, body: parse(draft) })), onSuccess: () => { toast.success(en.common.saved); void client.invalidateQueries({ queryKey: ['admin', 'rates'] }); }, onError: toastError });
  const remove = useMutation({ mutationFn: async () => { await expectOk(api.DELETE('/admin/delivery-rates/{id}', { params: { path: { id: rate.id } } })); }, onSuccess: () => { toast.success(en.common.deleted); void client.invalidateQueries({ queryKey: ['admin', 'rates'] }); }, onError: toastError });
  return (
    <RateRow
      draft={draft}
      onChange={setDraft}
      label={en.rates.vehicles[rate.vehicle]}
      actions={
        <span className="flex gap-1">
          <Button size="sm" disabled={!dirty || !valid(draft)} busy={save.isPending} onClick={() => { save.mutate(); }}>{en.common.save}</Button>
          <Button size="sm" variant="ghost" aria-label={`${en.common.delete} ${en.rates.vehicles[rate.vehicle]}`} busy={remove.isPending} onClick={() => { remove.mutate(); }}><Trash2 aria-hidden /></Button>
        </span>
      }
    />
  );
};

/** The table quotes use to price delivery: edit in place. */
const DeliveryRates = () => {
  const client = useQueryClient();
  const rates = useQuery({ queryKey: ['admin', 'rates'], queryFn: async () => (await unwrap(api.GET('/admin/delivery-rates', {}))).data });
  const empty: Draft = { vehicle: 'motorcycle', max_items: '', base_fee: '', per_km: '', max_km: '', active: true };
  const [draft, setDraft] = useState(empty);
  const add = useMutation({ mutationFn: async () => unwrap(api.POST('/admin/delivery-rates', { body: parse(draft) })), onSuccess: () => { setDraft(empty); toast.success(en.common.saved); void client.invalidateQueries({ queryKey: ['admin', 'rates'] }); }, onError: toastError });
  return (
    <div className="max-w-6xl">
      <PageHeader title={en.rates.title} intro={en.rates.intro} />
      {rates.isPending && <SkeletonList rows={2} />}
      {rates.isError && <ErrorState title={en.common.loadFailed} onRetry={() => { void rates.refetch(); }} retryLabel={en.common.retry} />}
      {rates.data && (
        <div tabIndex={0} role="region" aria-label={en.common.scrollTable} className="overflow-x-auto rounded-lg bg-paper shadow-card ring-1 ring-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-sand/70">
              <tr>{[en.rates.columns.vehicle, en.rates.columns.maxItems, en.rates.columns.base, en.rates.columns.perKm, en.rates.columns.maxKm, en.rates.columns.active, '', ''].map((h, i) => <th key={i} scope="col" className="h-9 border-b border-line px-3 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rates.data.map(r => <Existing key={`${r.id}${JSON.stringify(r)}`} rate={r} />)}
              <RateRow draft={draft} onChange={setDraft} label={en.rates.add} actions={<Button size="sm" disabled={!valid(draft)} busy={add.isPending} onClick={() => { add.mutate(); }}><Plus aria-hidden />{en.rates.add}</Button>} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default DeliveryRates;
