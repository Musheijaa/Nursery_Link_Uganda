import { unwrap } from '@nurserylink/api-client';
import { Button, ErrorState, Input, SkeletonList, formatDateTime } from '@nurserylink/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Pager } from '../components/Pager';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { Diff } from '../features/audit/Diff';
import { api } from '../lib/api';
import { usePage, useParam } from '../lib/params';

const LIMIT = 50;
const startOfDay = (d: string) => new Date(`${d}T00:00:00`).toISOString();
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999`).toISOString();

/** Every change, newest first. Filter by record type, action and dates; open a row for its before/after. */
const AuditLog = () => {
  const [entity, setEntity] = useParam('entity');
  const [action, setAction] = useParam('action');
  const [entityId] = useParam('entity_id');
  const [from, setFrom] = useParam('from');
  const [to, setTo] = useParam('to');
  const [page, setPage] = usePage();
  const [draft, setDraft] = useState({ entity: entity ?? '', action: action ?? '', from: from ?? '', to: to ?? '' });
  const [open, setOpen] = useState<Set<string>>(new Set());

  const log = useQuery({
    queryKey: ['admin', 'audit', entity, action, entityId, from, to, page],
    queryFn: async () =>
      unwrap(
        api.GET('/admin/audit-log', {
          params: {
            query: {
              page,
              limit: LIMIT,
              ...(entity ? { entity } : {}),
              ...(action ? { action } : {}),
              ...(entityId ? { entity_id: entityId } : {}),
              ...(from ? { from: startOfDay(from) } : {}),
              ...(to ? { to: endOfDay(to) } : {}),
            },
          },
        })
      ),
    placeholderData: keepPreviousData,
  });

  const toggle = (id: string) => { setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  return (
    <div>
      <PageHeader title={en.audit.title} intro={en.audit.intro} />
      <form
        role="search"
        className="mb-3 flex flex-wrap items-end gap-2"
        onSubmit={e => {
          e.preventDefault();
          setEntity(draft.entity.trim() || null);
          setAction(draft.action.trim() || null);
          setFrom(draft.from || null);
          setTo(draft.to || null);
        }}
      >
        {([['entity', en.audit.entity, 'text'], ['action', en.audit.action, 'text'], ['from', en.audit.from, 'date'], ['to', en.audit.to, 'date']] as const).map(([k, label, type]) => (
          <label key={k} className="flex flex-col gap-1 text-sm font-bold">
            {label}
            <Input type={type} className="min-h-9 w-44 text-sm" value={draft[k]} onChange={e => { setDraft(d => ({ ...d, [k]: e.target.value })); }} />
          </label>
        ))}
        <Button type="submit" size="sm" variant="secondary"><Search aria-hidden />{en.common.search}</Button>
      </form>

      {log.isPending && <SkeletonList rows={6} />}
      {log.isError && !log.data && <ErrorState title={en.common.loadFailed} onRetry={() => { void log.refetch(); }} retryLabel={en.common.retry} />}
      {log.data && (
        <div className="flex flex-col gap-3">
          <div tabIndex={0} role="region" aria-label={en.common.scrollTable} className="overflow-x-auto rounded-lg bg-paper shadow-card ring-1 ring-line">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-sand/70">
                <tr>{['', en.audit.columns.when, en.audit.columns.who, en.audit.columns.action, en.audit.columns.record].map((h, i) => <th key={i} scope="col" className="h-9 border-b border-line px-3 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {log.data.data.map(e => {
                  const expanded = open.has(e.id);
                  return (
                    <Fragment key={e.id}>
                      <tr className="hover:bg-forest-tint/50">
                        <td className="w-10 border-b border-line px-1">
                          <Button size="sm" variant="ghost" aria-expanded={expanded} aria-label={`${en.audit.showDiff}: ${e.action}`} onClick={() => { toggle(e.id); }}>
                            {expanded ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                          </Button>
                        </td>
                        <td className="border-b border-line px-3 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                        <td className="border-b border-line px-3">{e.actor?.full_name ?? en.audit.system}</td>
                        <td className="border-b border-line px-3 font-mono text-xs">{e.action}</td>
                        <td className="border-b border-line px-3 font-mono text-xs">{e.entity}{e.entity_id ? ` · ${e.entity_id.slice(0, 8)}` : ''}</td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td />
                          <td colSpan={4} className="border-b border-line px-3 py-2"><Diff before={e.before} after={e.after} /></td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {log.data.data.length === 0 && <p className="p-6 text-center text-bark-muted">{en.common.empty}</p>}
          </div>
          <Pager page={page} total={log.data.meta.total} limit={LIMIT} onPage={setPage} />
        </div>
      )}
    </div>
  );
};
export default AuditLog;
