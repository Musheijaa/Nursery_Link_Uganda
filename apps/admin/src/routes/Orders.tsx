import { orderStatuses, type OrderStatus } from '@nurserylink/shared';
import { Badge, Button, Select, formatDateTime, formatUGX } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminOrders, type AdminOrder } from '../features/orders/api';
import { StatusBadge } from '../features/orders/StatusBadge';
import { usePage, useParam } from '../lib/params';

const Orders = () => {
  const [raw, setStatus] = useParam('status');
  const [nursery, setNursery] = useParam('nursery');
  const [buyer, setBuyer] = useParam('buyer');
  const [q, setQ] = useParam('q');
  const [text, setText] = useState(q ?? '');
  const [page, setPage] = usePage();
  const status = orderStatuses.find(s => s === raw) ?? null;
  const list = useAdminOrders({ status, nursery, buyer, q }, page);
  // Names for the filter chips, from the rows themselves
  const first = list.data?.data[0];
  const columns = useMemo<ColumnDef<AdminOrder>[]>(() => [
    { header: en.orders.columns.code, cell: ({ row }) => <Link to={`/orders/${row.original.id}`} className="font-mono font-bold">{row.original.short_code}</Link> },
    { header: en.orders.columns.buyer, cell: ({ row }) => <Link to={`/orders?buyer=${row.original.buyer.id}`} title={en.orders.allFromBuyer}>{row.original.buyer.full_name}</Link> },
    { header: en.orders.columns.nursery, cell: ({ row }) => <Link to={`/orders?nursery=${row.original.nursery.id}`} title={en.orders.allFromNursery}>{row.original.nursery.name}</Link> },
    { header: en.orders.columns.total, cell: ({ row }) => <span className="tabular-nums">{formatUGX(row.original.grand_total)}</span> },
    { header: en.orders.columns.status, cell: ({ row }) => <StatusBadge status={row.original.status} method={row.original.payment_method} /> },
    { header: en.orders.columns.date, cell: ({ row }) => formatDateTime(row.original.created_at) },
  ], []);
  return (
    <div>
      <PageHeader title={en.orders.title} />
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <form role="search" className="flex w-full gap-2 sm:w-auto" onSubmit={e => { e.preventDefault(); setQ(text.trim() || null); }}>
          <label htmlFor="q" className="sr-only">{en.common.search}</label>
          <input id="q" value={text} onChange={e => { setText(e.target.value); }} placeholder={en.orders.searchPlaceholder} className="h-9 min-w-0 flex-1 rounded-sm border border-field bg-paper px-3 text-sm sm:w-72 sm:flex-none" />
          <Button type="submit" size="sm" variant="secondary"><Search aria-hidden />{en.common.search}</Button>
        </form>
        <label className="flex items-center gap-2 text-sm">
          {en.orders.status}
          <Select className="min-h-9 w-56 text-sm" value={status ?? ''} onChange={e => { setStatus(e.target.value || null); }}>
            <option value="">{en.orders.allStatuses}</option>
            {orderStatuses.map((s: OrderStatus) => <option key={s} value={s}>{en.orders.statuses[s]}</option>)}
          </Select>
        </label>
        {nursery && (
          <Badge tone="info" className="min-h-9">
            {en.orders.nurseryFilter(first?.nursery.id === nursery ? first.nursery.name : null)}
            <button type="button" onClick={() => { setNursery(null); }} aria-label={en.orders.clearFilter} className="-mr-1 flex size-6 items-center justify-center rounded-full hover:bg-paper"><X aria-hidden className="size-4" /></button>
          </Badge>
        )}
        {buyer && (
          <Badge tone="info" className="min-h-9">
            {en.orders.buyerFilter(first?.buyer.id === buyer ? first.buyer.full_name : null)}
            <button type="button" onClick={() => { setBuyer(null); }} aria-label={en.orders.clearFilter} className="-mr-1 flex size-6 items-center justify-center rounded-full hover:bg-paper"><X aria-hidden className="size-4" /></button>
          </Badge>
        )}
        {q && (
          <Badge tone="info" className="min-h-9">
            “{q}”
            <button type="button" onClick={() => { setQ(null); setText(''); }} aria-label={en.orders.clearFilter} className="-mr-1 flex size-6 items-center justify-center rounded-full hover:bg-paper"><X aria-hidden className="size-4" /></button>
          </Badge>
        )}
      </div>
      <DataTable columns={columns} data={list.data?.data} loading={list.isPending} error={list.error} onRetry={() => { void list.refetch(); }} getRowId={o => o.id} page={page} total={list.data?.meta.total ?? 0} limit={25} onPage={setPage} />
    </div>
  );
};
export default Orders;
