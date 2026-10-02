import type { EligibilityRule } from '@nurserylink/shared';
import { Button, Select } from '@nurserylink/ui';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { en } from '../../copy/en';

/** A rule while it is edited; the key is kept for saved rules and made from the label for new ones. */
export interface DraftRule {
  key: string | null;
  label: string;
  type: EligibilityRule['type'];
  required: boolean;
}

const slug = (label: string) => {
  const s = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return /^[a-z]/.test(s) ? s : `q_${s || 'rule'}`;
};

/** Saved rules keep their keys (answers already given use them); new ones get a unique key from the label. */
export const toRules = (drafts: DraftRule[]): EligibilityRule[] => {
  const used = new Set(drafts.flatMap(d => (d.key ? [d.key] : [])));
  return drafts
    .filter(d => d.label.trim() !== '')
    .map(d => {
      if (d.key) return { key: d.key, label: d.label.trim(), type: d.type, required: d.required };
      const base = slug(d.label);
      let key = base;
      for (let i = 2; used.has(key); i++) key = `${base}_${String(i)}`;
      used.add(key);
      return { key, label: d.label.trim(), type: d.type, required: d.required };
    });
};

/** Add, reorder and edit the questions applicants answer. */
export const RuleBuilder = ({ rules, onChange }: { rules: DraftRule[]; onChange: (rules: DraftRule[]) => void }) => {
  const set = (i: number, patch: Partial<DraftRule>) => { onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r))); };
  const move = (i: number, by: -1 | 1) => {
    const next = [...rules];
    const [r] = next.splice(i, 1);
    if (r) next.splice(i + by, 0, r);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {rules.map((r, i) => (
          <li key={r.key ?? `new-${String(i)}`} className="flex flex-wrap items-center gap-2 rounded-sm bg-mist p-2">
            <span className="w-6 text-center font-bold text-bark-muted">{i + 1}</span>
            <input
              aria-label={`${en.campaigns.ruleLabel} ${String(i + 1)}`}
              placeholder={en.campaigns.ruleLabel}
              className="h-9 min-w-40 flex-1 rounded-sm border border-field bg-paper px-2 text-sm"
              value={r.label}
              maxLength={200}
              onChange={e => { set(i, { label: e.target.value }); }}
            />
            <Select aria-label={`${en.campaigns.ruleType} ${String(i + 1)}`} className="min-h-9 w-28 text-sm" value={r.type} onChange={e => { set(i, { type: e.target.value as DraftRule['type'] }); }}>
              {(['boolean', 'number', 'text'] as const).map(t => <option key={t} value={t}>{en.campaigns.ruleTypes[t]}</option>)}
            </Select>
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5 accent-forest" checked={r.required} onChange={e => { set(i, { required: e.target.checked }); }} />
              {en.campaigns.ruleRequired}
            </label>
            <span className="flex">
              <Button size="sm" variant="ghost" aria-label={`Move rule ${String(i + 1)} up`} disabled={i === 0} onClick={() => { move(i, -1); }}><ArrowUp aria-hidden /></Button>
              <Button size="sm" variant="ghost" aria-label={`Move rule ${String(i + 1)} down`} disabled={i === rules.length - 1} onClick={() => { move(i, 1); }}><ArrowDown aria-hidden /></Button>
              <Button size="sm" variant="ghost" aria-label={`${en.common.remove} ${String(i + 1)}`} onClick={() => { onChange(rules.filter((_, j) => j !== i)); }}><Trash2 aria-hidden /></Button>
            </span>
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" className="self-start" disabled={rules.length >= 20} onClick={() => { onChange([...rules, { key: null, label: '', type: 'boolean', required: true }]); }}>
        <Plus aria-hidden />
        {en.campaigns.addRule}
      </Button>
    </div>
  );
};
