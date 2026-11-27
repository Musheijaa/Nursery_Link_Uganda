import { enquiryStatuses, enquiryTypes, type EnquiryStatus } from '@nurserylink/shared';
import { Badge, Button, Input, Select, formatDateTime, formatPhone, toast } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ReasonDialog } from '../components/ReasonDialog';
import { en } from '../copy/en';
import { downloadInboxCsv, useInbox, useUpdateEnquiry, type AdminEnquiry, type InboxFilter } from '../features/inbox/api';
import { toastError } from '../lib/errors';
import { usePage, useParam } from '../lib/params';

const STATUS_TONE = { new: 'info', in_progress: 'neutral', closed: 'positive' } as const;
const TYPE_TONE = { service: 'positive', donation: 'gift', partnership: 'info', contact: 'neutral', feedback: 'neutral' } as const;
const t = en.inbox;

/** Extra details (feedback kind and page, an older request's land size) as short "label: value" lines */
const Details = ({ e }: { e: AdminEnquiry }) => {
  const entries = Object.entries(e.details).filter(([, v]) => v !== null && v !== '');
  if (!entries.length) return null;
  const labels: Record<string, string> = t.detailLabels;
  return <span className="text-xs text-bark-muted">{entries.map(([k, v]) => `${labels[k] ?? k}: ${String(v)}`).join(' · ')}</span>;
};

/**
 * One inbox for everything people send the team: expert service requests, donations, partnerships,
 * contact messages and feedback. Opens on New; notes are kept and every change is audited.
 */
const Inbox = () => {
  const [type, setType] = useParam('type');
  const [status, setStatus] = useParam('status');
  const [q, setQ] = useParam('q');
  const [page, setPage] = usePage();
  const filter: InboxFilter = {
    type: enquiryTypes.find(x => x === type) ?? null,
    status: status === null ? 'new' : status === 'all' ? null : (enquiryStatuses.find(s => s === status) ?? 'new'),
    q: q ?? '',
  };
  const list = useInbox(filter, page);
  const update = useUpdateEnquiry();
  const [noting, setNoting] = useState<{ e: AdminEnquiry; next: EnquiryStatus } | null>(null);
  const [exporting, setExporting] = useState(false);

  const columns = useMemo<ColumnDef<AdminEnquiry>[]>(() => [
    { header: t.columns.type, cell: ({ row }) => <Badge tone={TYPE_TONE[row.original.type]}>{t.types[row.original.type]}</Badge> },
    {
      header: t.columns.from,
      cell: ({ row }) => {
        const e = row.original;
        return (
          <span className="flex flex-col text-xs">
            <span className="font-bold">{e.name ?? t.anonymous}</span>
            {e.organization && <span>{e.organization}</span>}
            {e.phone && <a href={`tel:${e.phone}`}>{formatPhone(e.phone)}</a>}
            {e.email && <a href={`mailto:${e.email}`}>{e.email}</a>}
            {e.district && <span className="text-bark-muted">{e.district}</span>}
          </span>
        );
      },
    },
    {
      header: t.columns.message,
      cell: ({ row }) => {
        const e = row.original;
        return (
          <span className="flex max-w-md flex-col gap-1">
            {e.service_category && <span className="text-xs font-bold text-canopy">{e.service_category.title}</span>}
            {e.services.length > 0 && <span className="text-xs">{e.services.join(' · ')}</span>}
            <span className="text-sm whitespace-pre-wrap">{e.message}</span>
            <Details e={e} />
          </span>
        );
      },
    },
    { header: t.columns.date, cell: ({ row }) => formatDateTime(row.original.created_at) },
    { header: t.columns.status, cell: ({ row }) => <Badge tone={STATUS_TONE[row.original.status]}>{t.statuses[row.original.status]}</Badge> },
    { header: t.columns.note, cell: ({ row }) => <span className="block max-w-xs text-xs">{row.original.admin_note ?? '—'}</span> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const e = row.original;
        return (
          <span className="flex flex-wrap gap-1">
            {e.status !== 'in_progress' && <Button size="sm" variant="secondary" onClick={() => { setNoting({ e, next: 'in_progress' }); }}>{t.actions.in_progress}</Button>}
            {e.status !== 'closed' && <Button size="sm" onClick={() => { setNoting({ e, next: 'closed' }); }}>{t.actions.closed}</Button>}
            {e.status === 'closed' && <Button size="sm" variant="ghost" onClick={() => { setNoting({ e, next: 'new' }); }}>{t.actions.new}</Button>}
          </span>
        );
      },
    },
  ], []);

  return (
    <div>
      <PageHeader
        title={t.title}
        intro={t.intro}
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => {
              setExporting(true);
              downloadInboxCsv(filter).catch(toastError).finally(() => { setExporting(false); });
            }}
          >
            <Download aria-hidden />
            {t.export}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-md bg-paper p-4 ring-1 ring-line">
        <label className="flex items-center gap-2 text-sm">
          {t.type}
          <Select className="min-h-9 w-48 text-sm" value={type ?? ''} onChange={e => { setType(e.target.value || null); }}>
            <option value="">{t.allTypes}</option>
            {enquiryTypes.map(x => <option key={x} value={x}>{t.types[x]}</option>)}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t.status}
          <Select className="min-h-9 w-40 text-sm" value={status ?? 'new'} onChange={e => { setStatus(e.target.value === 'new' ? null : e.target.value); }}>
            {enquiryStatuses.map(s => <option key={s} value={s}>{t.statuses[s]}</option>)}
            <option value="all">{en.common.all}</option>
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          {en.common.search}
          <Input className="min-h-9 w-56 text-sm" defaultValue={q ?? ''} placeholder={t.searchPlaceholder} onChange={e => { setQ(e.target.value || null, { replace: true }); }} />
        </label>
      </div>
      <DataTable columns={columns} data={list.data?.data} loading={list.isPending} error={list.error} onRetry={() => { void list.refetch(); }} getRowId={r => r.id} page={page} total={list.data?.meta.total ?? 0} limit={25} onPage={setPage} />
      <ReasonDialog
        open={noting !== null}
        onOpenChange={o => { if (!o) setNoting(null); }}
        title={noting ? t.noteTitle(t.statuses[noting.next]) : ''}
        confirmLabel={noting ? t.actions[noting.next] : ''}
        optional
        label={t.noteLabel}
        busy={update.isPending}
        onConfirm={note => {
          if (!noting) return;
          update.mutate({ id: noting.e.id, status: noting.next, note }, {
            onSuccess: () => { toast.success(t.toast(t.statuses[noting.next])); setNoting(null); },
            onError: toastError,
          });
        }}
      />
    </div>
  );
};
export default Inbox;
