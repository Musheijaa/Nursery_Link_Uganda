import { Badge, Button, ErrorState, Select, SkeletonList, StockMeter, formatCount, formatDateTime, formatPhone, toast } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ReasonDialog } from '../components/ReasonDialog';
import { en } from '../copy/en';
import { useAdminCampaign, useApplications, useReviewApplication, type AdminApplication, type Campaign } from '../features/campaigns/api';
import { toastError } from '../lib/errors';
import { usePage, useParam } from '../lib/params';

type Decision = { app: AdminApplication; status: 'approved' | 'rejected' | 'collected' };
const STATUSES = ['pending', 'approved', 'rejected', 'collected'] as const;
const TONE = { pending: 'info', approved: 'positive', rejected: 'neutral', collected: 'positive' } as const;

const Answers = ({ app, campaign }: { app: AdminApplication; campaign: Campaign }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
    {campaign.eligibility_rules.map(r => {
      const v = app.answers[r.key];
      return [
        <dt key={`${r.key}-l`} className="text-bark-muted">{r.label}</dt>,
        <dd key={`${r.key}-v`} className="font-bold">{v === undefined ? '—' : typeof v === 'boolean' ? (v ? en.common.yes : en.common.no) : String(v)}</dd>,
      ];
    })}
  </dl>
);

/** Review queue: pending first by default, with the stock left always in view. */
const Applications = () => {
  const { id = '' } = useParams();
  const [status, setStatus] = useParam('status');
  const [page, setPage] = usePage();
  const filter = status === null ? 'pending' : status === 'all' ? null : (STATUSES.find(s => s === status) ?? 'pending');
  const campaign = useAdminCampaign(id);
  const list = useApplications(id, filter, page);
  const review = useReviewApplication();
  const [decision, setDecision] = useState<Decision | null>(null);

  const columns = useMemo<ColumnDef<AdminApplication>[]>(() => {
    const c = campaign.data;
    if (!c) return [];
    return [
      { header: en.applications.columns.applicant, cell: ({ row }) => <span className="flex flex-col"><span className="font-bold">{row.original.applicant.full_name}</span><a href={`tel:${row.original.applicant.phone}`} className="text-xs">{formatPhone(row.original.applicant.phone)}</a></span> },
      { header: en.applications.columns.answers, cell: ({ row }) => <Answers app={row.original} campaign={c} /> },
      { header: en.applications.columns.quantity, cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.quantity_requested)}</span> },
      { header: en.applications.columns.date, cell: ({ row }) => formatDateTime(row.original.created_at) },
      { header: en.applications.columns.status, cell: ({ row }) => <Badge tone={TONE[row.original.status]}>{en.applications.statuses[row.original.status]}</Badge> },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const a = row.original;
          if (a.status === 'pending') {
            const short = a.quantity_requested > c.remaining_stock;
            return (
              <span className="flex flex-wrap gap-1">
                <Button size="sm" disabled={short} title={short ? en.applications.notEnough : undefined} onClick={() => { setDecision({ app: a, status: 'approved' }); }}>{en.applications.approve}</Button>
                <Button size="sm" variant="secondary" onClick={() => { setDecision({ app: a, status: 'rejected' }); }}>{en.applications.reject}</Button>
                {short && <span className="text-xs text-laterite">{en.applications.notEnough}</span>}
              </span>
            );
          }
          if (a.status === 'approved') return <Button size="sm" variant="secondary" onClick={() => { setDecision({ app: a, status: 'collected' }); }}>{en.applications.collected}</Button>;
          return null;
        },
      },
    ];
  }, [campaign.data]);

  if (campaign.isPending) return <SkeletonList rows={4} />;
  if (!campaign.data) return <ErrorState title={en.common.loadFailed} onRetry={() => { void campaign.refetch(); }} retryLabel={en.common.retry} />;
  const c = campaign.data;
  const label = decision ? { approved: en.applications.approve, rejected: en.applications.reject, collected: en.applications.collected }[decision.status] : '';

  return (
    <div>
      <PageHeader title={en.applications.title(c.title)} actions={<Button asChild size="sm" variant="ghost"><Link to={`/campaigns/${c.id}`}>{en.common.back}</Link></Button>} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 rounded-md border-l-4 border-sun bg-paper p-4 ring-1 ring-line">
        <div className="w-72">
          <p className="mb-1 font-bold">{en.applications.remaining(formatCount(c.remaining_stock))}</p>
          <StockMeter remaining={c.remaining_stock} total={c.allocated_stock} label={en.applications.remaining(formatCount(c.remaining_stock))} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          {en.payouts.status}
          <Select className="min-h-9 w-40 text-sm" value={status ?? 'pending'} onChange={e => { setStatus(e.target.value === 'pending' ? null : e.target.value); }}>
            {STATUSES.map(s => <option key={s} value={s}>{en.applications.statuses[s]}</option>)}
            <option value="all">{en.common.all}</option>
          </Select>
        </label>
      </div>
      <DataTable columns={columns} data={list.data?.data} loading={list.isPending} error={list.error} onRetry={() => { void list.refetch(); }} getRowId={a => a.id} page={page} total={list.data?.meta.total ?? 0} limit={25} onPage={setPage} />
      <ReasonDialog
        open={decision !== null}
        onOpenChange={o => { if (!o) setDecision(null); }}
        title={decision ? `${label}: ${decision.app.applicant.full_name} (${formatCount(decision.app.quantity_requested)})` : ''}
        confirmLabel={label}
        danger={decision?.status === 'rejected'}
        optional
        label={en.applications.noteLabel}
        busy={review.isPending}
        onConfirm={note => {
          if (!decision) return;
          review.mutate({ id: decision.app.id, status: decision.status, note }, {
            onSuccess: () => {
              toast.success({ approved: en.applications.approvedToast, rejected: en.applications.rejectedToast, collected: en.applications.collectedToast }[decision.status]);
              setDecision(null);
            },
            onError: toastError,
          });
        }}
      />
    </div>
  );
};
export default Applications;
