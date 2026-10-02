import { Button, Select, formatRelative, toast } from '@nurserylink/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { en } from '../../copy/en';
import { toastError } from '../../lib/errors';
import { useAddLine, useDeleteLine, useSpeciesOptions, useUpdateLine, type InventoryLine } from './api';

const cell = 'h-9 w-28 rounded-sm border border-field bg-paper px-2 text-right text-sm tabular-nums aria-[invalid=true]:border-laterite';
const toInt = (v: string) => (/^\d+$/.test(v.replace(/,/g, '')) ? Number(v.replace(/,/g, '')) : NaN);

/** One editable stock line: change the numbers, Save (or Enter); the row shows unsaved changes. */
const Line = ({ line }: { line: InventoryLine }) => {
  const [qty, setQty] = useState(String(line.quantity_available));
  const [price, setPrice] = useState(String(line.unit_price));
  const update = useUpdateLine();
  const remove = useDeleteLine();
  const q = toInt(qty);
  const p = toInt(price);
  const valid = Number.isFinite(q) && Number.isFinite(p) && p >= 1;
  const dirty = q !== line.quantity_available || p !== line.unit_price;
  const save = () => {
    if (!valid || !dirty) return;
    update.mutate({ id: line.id, quantity_available: q, unit_price: p }, { onSuccess: () => { toast.success(en.inventory.rowSaved(line.species.common_name)); }, onError: toastError });
  };
  return (
    <tr className={dirty ? 'bg-amber-tint/50' : undefined}>
      <th scope="row" className="h-9 border-b border-line px-3 text-left font-bold">{line.species.common_name}</th>
      <td className="border-b border-line px-3">
        <input aria-label={`${en.inventory.columns.quantity}: ${line.species.common_name}`} className={cell} inputMode="numeric" value={qty} aria-invalid={!Number.isFinite(q) || undefined} onChange={e => { setQty(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
      </td>
      <td className="border-b border-line px-3">
        <input aria-label={`${en.inventory.columns.price}: ${line.species.common_name}`} className={cell} inputMode="numeric" value={price} aria-invalid={!(Number.isFinite(p) && p >= 1) || undefined} onChange={e => { setPrice(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
      </td>
      <td className="border-b border-line px-3 text-sm text-bark-muted">{formatRelative(line.updated_at)}</td>
      <td className="border-b border-line px-3">
        <span className="flex gap-1">
          {/* Save appears on rows with unsaved changes only */}
          <Button size="sm" className={dirty ? undefined : 'invisible'} disabled={!valid} busy={update.isPending} onClick={save}>{en.common.save}</Button>
          <Button size="sm" variant="ghost" aria-label={`${en.common.delete} ${line.species.common_name}`} busy={remove.isPending} onClick={() => { remove.mutate(line.id, { onSuccess: () => { toast.success(en.common.deleted); }, onError: toastError }); }}>
            <Trash2 aria-hidden />
          </Button>
        </span>
      </td>
    </tr>
  );
};

/** The nursery's stock as an editable grid, with a row for adding a tree. */
export const StockGrid = ({ nurseryId, lines }: { nurseryId: string; lines: InventoryLine[] }) => {
  const species = useSpeciesOptions();
  const add = useAddLine();
  const [speciesId, setSpeciesId] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const listed = new Set(lines.map(l => l.species.id));
  const q = toInt(qty);
  const p = toInt(price);
  return (
    <div tabIndex={0} role="region" aria-label={en.common.scrollTable} className="overflow-x-auto rounded-lg bg-paper shadow-card ring-1 ring-line">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-sand/70">
          <tr>
            {[en.inventory.columns.species, en.inventory.columns.quantity, en.inventory.columns.price, en.inventory.columns.updated, ''].map((h, i) => (
              <th key={i} scope="col" className="h-9 border-b border-line px-3 text-left font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map(l => <Line key={`${l.id}-${l.updated_at}`} line={l} />)}
          <tr className="bg-mist/50">
            <td className="px-3 py-2">
              <label className="sr-only" htmlFor="new-species">{en.inventory.species}</label>
              <Select id="new-species" className="min-h-9 text-sm" value={speciesId} onChange={e => { setSpeciesId(e.target.value); }}>
                <option value="">{en.inventory.addLine}…</option>
                {species.data?.filter(s => !listed.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.common_name}</option>)}
              </Select>
            </td>
            <td className="px-3"><input aria-label={en.inventory.quantity} className={cell} inputMode="numeric" value={qty} onChange={e => { setQty(e.target.value); }} /></td>
            <td className="px-3"><input aria-label={en.inventory.price} className={cell} inputMode="numeric" value={price} onChange={e => { setPrice(e.target.value); }} /></td>
            <td />
            <td className="px-3">
              <Button
                size="sm"
                disabled={!speciesId || !Number.isFinite(q) || !(Number.isFinite(p) && p >= 1)}
                busy={add.isPending}
                onClick={() => {
                  add.mutate({ nursery_id: nurseryId, species_id: speciesId, quantity_available: q, unit_price: p }, {
                    onSuccess: () => { setSpeciesId(''); setQty(''); setPrice(''); toast.success(en.common.saved); },
                    onError: toastError,
                  });
                }}
              >
                <Plus aria-hidden />
                {en.common.add}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
