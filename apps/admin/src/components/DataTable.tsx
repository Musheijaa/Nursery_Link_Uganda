import { EmptyState, ErrorState, Skeleton, cn } from '@nurserylink/ui';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { en } from '../copy/en';
import { Pager } from './Pager';

/**
 * A dense table for data entry (36 px rows), paged on the server. Rows can link somewhere
 * (`rowLink`), and every state (loading, empty, error) has its own message.
 */
export const DataTable = <T,>({ columns, data, loading, error, onRetry, page, total, limit, onPage, empty, getRowId, rowClassName }: {
  columns: ColumnDef<T>[];
  data: T[] | undefined;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  page?: number;
  total?: number;
  limit?: number;
  onPage?: (page: number) => void;
  empty?: ReactNode;
  getRowId: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
}) => {
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns new functions each render; this component is not memoised
  const table = useReactTable({ data: data ?? [], columns, getCoreRowModel: getCoreRowModel(), getRowId, manualPagination: true });
  if (error && !data) return <ErrorState title={en.common.loadFailed} onRetry={onRetry} retryLabel={en.common.retry} />;
  return (
    <div className="flex flex-col gap-3">
      <div tabIndex={0} role="region" aria-label={en.common.scrollTable} className="overflow-x-auto rounded-lg bg-paper shadow-card ring-1 ring-line">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-sand/70">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} scope="col" className="h-9 border-b border-line px-3 font-bold whitespace-nowrap text-bark">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && !data
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((_c, j) => <td key={j} className="h-9 border-b border-line px-3"><Skeleton className="h-4 w-3/4" /></td>)}
                  </tr>
                ))
              : table.getRowModel().rows.map(row => (
                  <tr key={row.id} className={cn('hover:bg-forest-tint/50', rowClassName?.(row.original))}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="h-9 border-b border-line px-3 py-1 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {data?.length === 0 && <EmptyState icon={Inbox} title={en.common.empty} className="rounded-none ring-0">{empty}</EmptyState>}
      </div>
      {page !== undefined && total !== undefined && limit !== undefined && onPage && <Pager page={page} total={total} limit={limit} onPage={onPage} />}
    </div>
  );
};
