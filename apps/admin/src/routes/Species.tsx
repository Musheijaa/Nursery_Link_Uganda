import { speciesCategories } from '@nurserylink/shared';
import { Button, Select } from '@nurserylink/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminSpecies, type SpeciesItem } from '../features/species/api';
import { usePage, useParam } from '../lib/params';

const Species = () => {
  const [q, setQ] = useParam('q');
  const [category, setCategory] = useParam('category');
  const [page, setPage] = usePage();
  const [text, setText] = useState(q ?? '');
  const list = useAdminSpecies(q ?? '', category, page);
  const columns = useMemo<ColumnDef<SpeciesItem>[]>(() => [
    { header: en.species.columns.name, cell: ({ row }) => <Link to={`/species/${row.original.id}`} className="font-bold">{row.original.common_name}</Link> },
    { header: en.species.columns.scientific, cell: ({ row }) => <i className="font-serif">{row.original.scientific_name}</i> },
    { header: en.species.columns.category, cell: ({ row }) => en.species.categories[row.original.category] },
    { header: en.species.columns.nurseries, cell: ({ row }) => row.original.nursery_count },
  ], []);
  return (
    <div>
      <PageHeader title={en.species.title} actions={<Button asChild size="sm"><Link to="/species/new"><Plus aria-hidden />{en.species.new}</Link></Button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <form role="search" className="flex w-full gap-2 sm:w-auto" onSubmit={e => { e.preventDefault(); setQ(text.trim() || null); }}>
          <label htmlFor="q" className="sr-only">{en.common.search}</label>
          <input id="q" value={text} onChange={e => { setText(e.target.value); }} placeholder={en.species.searchPlaceholder} className="h-9 min-w-0 flex-1 rounded-sm border border-field bg-paper px-3 text-sm sm:w-64 sm:flex-none" />
          <Button type="submit" size="sm" variant="secondary"><Search aria-hidden />{en.common.search}</Button>
        </form>
        <label className="sr-only" htmlFor="cat">{en.species.category}</label>
        <Select id="cat" className="min-h-9 w-48 text-sm" value={category ?? ''} onChange={e => { setCategory(e.target.value || null); }}>
          <option value="">{en.species.category}: {en.common.all}</option>
          {speciesCategories.map(c => <option key={c} value={c}>{en.species.categories[c]}</option>)}
        </Select>
      </div>
      <DataTable columns={columns} data={list.data?.data} loading={list.isPending} error={list.error} onRetry={() => { void list.refetch(); }} getRowId={s => s.id} page={page} total={list.data?.meta.total ?? 0} limit={25} onPage={setPage} />
    </div>
  );
};
export default Species;
