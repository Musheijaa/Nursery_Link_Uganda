import { Badge, Button, StockMeter, formatDate } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminCampaigns, type Campaign } from '../features/campaigns/api';
import { usePage } from '../lib/params';

const Campaigns = () => {
  const [page, setPage] = usePage();
  const list = useAdminCampaigns(page);
  const columns = useMemo<ColumnDef<Campaign>[]>(() => [
    { header: en.campaigns.columns.title, cell: ({ row }) => <span className="flex flex-col"><Link to={`/campaigns/${row.original.id}`} className="font-bold">{row.original.title}</Link><span className="text-xs text-bark-muted">{row.original.funder_name}</span></span> },
    { header: en.campaigns.columns.sub, cell: ({ row }) => row.original.sub_county.name },
    { header: en.campaigns.columns.stock, cell: ({ row }) => <span className="block w-40"><StockMeter remaining={row.original.remaining_stock} total={row.original.allocated_stock} label={`${row.original.title}: ${en.campaigns.columns.stock}`} /></span> },
    { header: en.campaigns.columns.dates, cell: ({ row }) => `${formatDate(row.original.starts_at)} – ${formatDate(row.original.ends_at)}` },
    { header: en.campaigns.columns.status, cell: ({ row }) => <Badge tone={row.original.is_open ? 'gift' : 'neutral'}>{row.original.is_open ? en.campaigns.open : en.campaigns.closed}</Badge> },
    { id: 'apps', header: '', cell: ({ row }) => <Link to={`/campaigns/${row.original.id}/applications`} className="text-sm">{en.campaigns.applications}</Link> },
  ], []);
  return (
    <div>
      <PageHeader title={en.campaigns.title} actions={<Button asChild size="sm"><Link to="/campaigns/new"><Plus aria-hidden />{en.campaigns.new}</Link></Button>} />
      <DataTable columns={columns} data={list.data?.data} loading={list.isPending} error={list.error} onRetry={() => { void list.refetch(); }} getRowId={c => c.id} page={page} total={list.data?.meta.total ?? 0} limit={25} onPage={setPage} />
    </div>
  );
};
export default Campaigns;
