import { Badge, Button, Select, formatRelative } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { PAGE_SIZE, useAdminNurseries, useDistricts, useSubCounties, type AdminNursery } from '../features/nurseries/api';
import { usePage, useParam } from '../lib/params';

const STALE_DAYS = 30;

const Nurseries = () => {
  const [q, setQ] = useParam('q');
  const [district, setDistrict] = useParam('district');
  const [subCounty, setSubCounty] = useParam('sub_county');
  const [active, setActive] = useParam('active');
  const [showParam, setShow] = useParam('show');
  const show = showParam === 'real' || showParam === 'demo' || showParam === 'to_verify' ? showParam : null;
  const [page, setPage] = usePage();
  const [text, setText] = useState(q ?? '');
  const list = useAdminNurseries({ q: q ?? '', district, subCounty, active: active === 'true' || active === 'false' ? active : null, show }, page);
  const districts = useDistricts();
  const subs = useSubCounties(district);

  const columns = useMemo<ColumnDef<AdminNursery>[]>(() => [
    {
      header: en.nurseries.columns.name,
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Link to={`/nurseries/${row.original.id}`} className="font-bold">{row.original.name}</Link>
          {row.original.is_demo && <Badge tone="neutral">{en.nurseries.sample}</Badge>}
          {!row.original.is_active && row.original.listing_note && <Badge tone="info">{en.nurseries.toVerify}</Badge>}
        </span>
      ),
    },
    { header: en.nurseries.columns.place, cell: ({ row }) => `${row.original.sub_county.name}, ${row.original.district.name}` },
    { header: en.nurseries.columns.type, cell: ({ row }) => en.nurseries.types[row.original.type] },
    { header: en.nurseries.columns.cert, cell: ({ row }) => en.nurseries.certs[row.original.certification_status] },
    {
      header: en.nurseries.columns.stock,
      cell: ({ row }) => {
        const at = row.original.stock_updated_at;
        if (!at) return <Badge tone="stale">{en.dashboard.neverUpdated}</Badge>;
        const stale = (Date.now() - new Date(at).getTime()) / 86_400_000 > STALE_DAYS;
        return stale ? <Badge tone="stale">{formatRelative(at)}</Badge> : formatRelative(at);
      },
    },
    { header: en.nurseries.columns.status, cell: ({ row }) => <Badge tone={row.original.is_active ? 'positive' : 'neutral'}>{row.original.is_active ? en.common.active : en.common.inactive}</Badge> },
    { id: 'stock', header: '', cell: ({ row }) => <Link to={`/inventory?nursery=${row.original.id}`} className="text-sm">{en.nurseries.inventory}</Link> },
  ], []);

  return (
    <div>
      <PageHeader title={en.nurseries.title} actions={<Button asChild size="sm"><Link to="/nurseries/new"><Plus aria-hidden />{en.nurseries.new}</Link></Button>} />
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <form role="search" className="flex w-full gap-2 sm:w-auto" onSubmit={e => { e.preventDefault(); setQ(text.trim() || null); }}>
          <label htmlFor="q" className="sr-only">{en.common.search}</label>
          <input id="q" value={text} onChange={e => { setText(e.target.value); }} placeholder={en.nurseries.searchPlaceholder} className="h-9 min-w-0 flex-1 rounded-sm border border-field bg-paper px-3 text-sm sm:w-64 sm:flex-none" />
          <Button type="submit" size="sm" variant="secondary"><Search aria-hidden />{en.common.search}</Button>
        </form>
        <label className="sr-only" htmlFor="district">{en.nurseries.district}</label>
        <Select id="district" className="min-h-9 w-48 text-sm" value={district ?? ''} onChange={e => { setDistrict(e.target.value || null); setSubCounty(null); }}>
          <option value="">{en.nurseries.district}: {en.common.all}</option>
          {districts.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <label className="sr-only" htmlFor="sub">{en.nurseries.subCounty}</label>
        <Select id="sub" className="min-h-9 w-56 text-sm" value={subCounty ?? ''} disabled={!district} onChange={e => { setSubCounty(e.target.value || null); }}>
          <option value="">{en.nurseries.subCounty}: {en.common.all}</option>
          {subs.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <label className="sr-only" htmlFor="active">{en.nurseries.columns.status}</label>
        <Select id="active" className="min-h-9 w-40 text-sm" value={active ?? ''} onChange={e => { setActive(e.target.value || null); }}>
          <option value="">{en.nurseries.columns.status}: {en.common.all}</option>
          <option value="true">{en.common.active}</option>
          <option value="false">{en.common.inactive}</option>
        </Select>
        <label className="sr-only" htmlFor="show">{en.nurseries.show}</label>
        <Select id="show" className="min-h-9 w-52 text-sm" value={show ?? ''} onChange={e => { setShow(e.target.value || null); }}>
          <option value="">{en.nurseries.show}: {en.common.all}</option>
          <option value="real">{en.nurseries.showReal}</option>
          <option value="to_verify">{en.nurseries.toVerify}</option>
          <option value="demo">{en.nurseries.showDemo}</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={list.data?.data}
        loading={list.isPending}
        error={list.error}
        onRetry={() => { void list.refetch(); }}
        getRowId={n => n.id}
        page={page}
        total={list.data?.meta.total ?? 0}
        limit={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  );
};
export default Nurseries;
