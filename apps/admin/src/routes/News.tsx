import { Badge, Button, formatDate } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminNews, type AdminNews } from '../features/news/api';
import { usePage } from '../lib/params';

const state = (n: AdminNews) => (!n.is_published ? 'draft' : n.published_at && new Date(n.published_at) > new Date() ? 'scheduled' : 'published');

const News = () => {
  const [page, setPage] = usePage();
  const list = useAdminNews(page);
  const columns = useMemo<ColumnDef<AdminNews>[]>(() => [
    { header: en.news.columns.title, cell: ({ row }) => <Link to={`/news/${row.original.id}`} className="font-bold">{row.original.title}</Link> },
    { header: en.news.columns.category, cell: ({ row }) => en.news.categories[row.original.category] },
    { header: en.news.columns.status, cell: ({ row }) => { const s = state(row.original); return <Badge tone={s === 'published' ? 'positive' : s === 'scheduled' ? 'info' : 'neutral'}>{en.news[s]}</Badge>; } },
    { header: en.news.columns.date, cell: ({ row }) => (row.original.published_at ? formatDate(row.original.published_at) : '—') },
  ], []);
  return (
    <div>
      <PageHeader title={en.news.title} actions={<Button asChild size="sm"><Link to="/news/new"><Plus aria-hidden />{en.news.new}</Link></Button>} />
      <DataTable columns={columns} data={list.data?.data} loading={list.isPending} error={list.error} onRetry={() => { void list.refetch(); }} getRowId={n => n.id} page={page} total={list.data?.meta.total ?? 0} limit={25} onPage={setPage} />
    </div>
  );
};
export default News;
