import { orderStatuses, type OrderStatus } from '@nurserylink/shared';
import { Select, formatDateTime, formatUGX } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminOrders, type AdminOrder } from '../features/orders/api';
import { StatusBadge } from '../features/orders/StatusBadge';
import { usePage, useParam } from '../lib/params';

const Orders = () => {
  const [raw, setStatus] = useParam('status');
  const [page, setPage] = usePage();
  const status = orderStatuses.find(s => s === raw) ?? null;
  const list = useAdminOrders(status, page);
  const columns = useMemo<ColumnDef<AdminOrder>[]>(() => [
    { header: en.orders.columns.code, cell: ({ row }) => <Link to={`/orders/${row.original.id}`} className="font-mono font-bold">{row.original.short_code}</Link> },
    { header: en.orders.columns.buyer, cell: ({ row }) => row.original.buyer.full_name },
    { header: en.orders.columns.nursery, cell: ({ row }) => row.original.nursery.name },
    { header: en.orders.columns.total, cell: ({ row }) => <span className="tabular-nums">{formatUGX(row.original.grand_total)}</span> },
    { header: en.orders.columns.status, cell: ({ row }) => <StatusBadge status={row.original.status} method={row.original.payment_method} /> },
    { header: en.orders.columns.date, cell: ({ row }) => formatDateTime(row.original.created_at) },
  ], []);
  return (
    <div>
      <PageHeader title={en.orders.title} />
      <div className="mb-3">
        <label className="flex items-center gap-2 text-sm">
          {en.orders.status}
          <Select className="min-h-9 w-56 text-sm" value={status ?? ''} onChange={e => { setStatus(e.target.value || null); }}>
            <option value="">{en.orders.allStatuses}</option>
            {orderStatuses.map((s: OrderStatus) => <option key={s} value={s}>{en.orders.statuses[s]}</option>)}
          </Select>
        </label>
      </div>
      <DataTable columns={columns} data={list.data?.data} loading={list.isPending} error={list.error} onRetry={() => { void list.refetch(); }} getRowId={o => o.id} page={page} total={list.data?.meta.total ?? 0} limit={25} onPage={setPage} />
    </div>
  );
};
export default Orders;
