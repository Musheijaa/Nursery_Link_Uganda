import { Badge, Button, Select, formatPhone, formatRelative, formatUGX, toast } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ReasonDialog } from '../components/ReasonDialog';
import { en } from '../copy/en';
import { usePayouts, useRetryPayout, type Payout } from '../features/orders/api';
import { toastError } from '../lib/errors';
import { usePage, useParam } from '../lib/params';

const STATUSES = ['failed', 'pending', 'successful'] as const;
const TONE = { failed: 'danger', pending: 'info', successful: 'positive' } as const;

const Payouts = () => {
  const [raw, setStatus] = useParam('status');
  const [page, setPage] = usePage();
  const status = raw === 'all' ? null : (STATUSES.find(s => s === raw) ?? 'failed');
  const list = usePayouts(status, page);
  const retry = useRetryPayout();
  const [target, setTarget] = useState<Payout | null>(null);

  const columns = useMemo<ColumnDef<Payout>[]>(() => [
    { header: en.payouts.columns.order, cell: ({ row }) => <span className="flex flex-col"><Link to={`/orders/${row.original.order_id}`} className="font-mono font-bold">{row.original.short_code}</Link><span className="text-xs text-bark-muted">{row.original.nursery_name}</span></span> },
    { header: en.payouts.columns.kind, cell: ({ row }) => en.payouts.kinds[row.original.kind] },
    { header: en.payouts.columns.to, cell: ({ row }) => formatPhone(row.original.msisdn) },
    { header: en.payouts.columns.amount, cell: ({ row }) => <span className="tabular-nums">{formatUGX(row.original.amount)}</span> },
    { header: en.payouts.columns.status, cell: ({ row }) => <Badge tone={TONE[row.original.status]}>{en.payouts.statuses[row.original.status]}</Badge> },
    { header: en.payouts.columns.attempts, cell: ({ row }) => row.original.attempts },
    { header: en.payouts.columns.updated, cell: ({ row }) => formatRelative(row.original.updated_at) },
    { id: 'retry', header: '', cell: ({ row }) => (row.original.status === 'failed' ? <Button size="sm" onClick={() => { setTarget(row.original); }}>{en.payouts.retry}</Button> : null) },
  ], []);

  return (
    <div>
      <PageHeader title={en.payouts.title} intro={en.payouts.intro} />
      <label className="mb-3 flex items-center gap-2 text-sm">
        {en.payouts.status}
        <Select className="min-h-9 w-40 text-sm" value={status ?? 'all'} onChange={e => { setStatus(e.target.value === 'failed' ? null : e.target.value); }}>
          {STATUSES.map(s => <option key={s} value={s}>{en.payouts.statuses[s]}</option>)}
          <option value="all">{en.common.all}</option>
        </Select>
      </label>
      <DataTable columns={columns} data={list.data?.data} loading={list.isPending} error={list.error} onRetry={() => { void list.refetch(); }} getRowId={p => p.id} page={page} total={list.data?.meta.total ?? 0} limit={25} onPage={setPage} />
      <ReasonDialog
        open={target !== null}
        onOpenChange={o => { if (!o) setTarget(null); }}
        title={target ? `${en.payouts.retry}: ${formatUGX(target.amount)} → ${formatPhone(target.msisdn)}` : ''}
        confirmLabel={en.payouts.retry}
        optional
        label={en.applications.noteLabel}
        busy={retry.isPending}
        onConfirm={() => {
          if (!target) return;
          retry.mutate(target.id, { onSuccess: () => { toast.success(en.payouts.retried); setTarget(null); }, onError: toastError });
        }}
      />
    </div>
  );
};
export default Payouts;
