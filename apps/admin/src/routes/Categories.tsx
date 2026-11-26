import { categoryCreateSchema } from '@nurserylink/shared';
import { Badge, Button, Checkbox, ErrorState, Input, SkeletonList, Textarea, cn, toast } from '@nurserylink/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminCategories, useCreateCategory, useDeleteCategory, useUpdateCategory, type AdminCategory, type CategoryKind } from '../features/content/api';
import { toastError } from '../lib/errors';
import { useParam } from '../lib/params';

const t = en.categories;

/** One category: label, description and order edited in place; slugs never change (links use them). */
const Row = ({ kind, c }: { kind: CategoryKind; c: AdminCategory }) => {
  const update = useUpdateCategory(kind);
  const remove = useDeleteCategory(kind);
  const [label, setLabel] = useState(c.label);
  const [description, setDescription] = useState(c.description ?? '');
  const [order, setOrder] = useState(String(c.sort_order));
  const dirty = label !== c.label || description !== (c.description ?? '') || order !== String(c.sort_order);
  return (
    <li className={cn('grid gap-2 rounded-md bg-paper p-3 ring-1 ring-line md:grid-cols-[5rem_1fr_2fr_auto] md:items-start', dirty && 'bg-sun-tint/50')}>
      <Input aria-label={`${t.order}: ${c.label}`} inputMode="numeric" className="min-h-9 text-sm" value={order} onChange={e => { setOrder(e.target.value); }} />
      <div className="flex flex-col gap-1">
        <Input aria-label={`${t.label}: ${c.label}`} className="min-h-9 text-sm font-bold" value={label} onChange={e => { setLabel(e.target.value); }} />
        <span className="text-xs text-bark-muted">{c.slug} · {t.uses(kind, c.uses)}</span>
      </div>
      <Textarea aria-label={`${t.description}: ${c.label}`} rows={2} className="text-sm" value={description} onChange={e => { setDescription(e.target.value); }} />
      <div className="flex flex-wrap items-center gap-1">
        <Checkbox
          label={c.is_active ? en.common.active : en.common.inactive}
          checked={c.is_active}
          onChange={e => { update.mutate({ slug: c.slug, body: { is_active: e.target.checked } }, { onError: toastError }); }}
        />
        {dirty && (
          <Button
            size="sm"
            busy={update.isPending}
            onClick={() => {
              update.mutate(
                { slug: c.slug, body: { label: label.trim(), description: description.trim() || null, sort_order: Number(order) || 0 } },
                { onSuccess: () => { toast.success(en.common.changesSaved); }, onError: toastError }
              );
            }}
          >
            {en.common.save}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-label={`${en.common.delete} ${c.label}`}
          disabled={c.uses > 0 || remove.isPending}
          title={c.uses > 0 ? t.inUse : undefined}
          onClick={() => { remove.mutate(c.slug, { onSuccess: () => { toast.success(en.common.deleted); }, onError: toastError }); }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
};

const AddCategory = ({ kind }: { kind: CategoryKind }) => {
  const create = useCreateCategory(kind);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-wrap items-start gap-2"
      onSubmit={e => {
        e.preventDefault();
        const parsed = categoryCreateSchema.safeParse({ label, sort_order: 100 });
        if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? en.common.required); return; }
        create.mutate(parsed.data, { onSuccess: () => { setLabel(''); setError(null); toast.success(t.added); }, onError: toastError });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        {t.newLabel}
        <Input className="min-h-9 w-72 text-sm" value={label} onChange={e => { setLabel(e.target.value); }} invalid={error !== null} />
        {error && <span className="font-bold text-laterite">{error}</span>}
      </label>
      <Button type="submit" size="sm" className="mt-6" busy={create.isPending}><Plus aria-hidden />{en.common.add}</Button>
    </form>
  );
};

/** Tree categories (the Tree Library and Find Nurseries filters) and News & Updates categories. */
const Categories = () => {
  const [tab, setTab] = useParam('kind');
  const kind: CategoryKind = tab === 'news' ? 'news' : 'tree';
  const list = useAdminCategories(kind);
  return (
    <div className="max-w-5xl">
      <PageHeader title={t.title} intro={t.intro} />
      <div role="tablist" aria-label={t.title} className="mb-4 flex gap-2">
        {(['tree', 'news'] as const).map(k => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => { setTab(k === 'tree' ? null : k); }}
            className={cn('min-h-9 rounded-sm px-3 text-sm font-bold', kind === k ? 'bg-forest text-paper' : 'text-forest ring-1 ring-line hover:bg-forest-tint')}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm text-bark-muted">{t.help[kind]}</p>
      {list.isPending && <SkeletonList rows={5} />}
      {list.isError && <ErrorState title={en.common.loadFailed} onRetry={() => { void list.refetch(); }} retryLabel={en.common.retry} />}
      {list.data && (
        <>
          <div className="mb-1 hidden gap-2 px-3 text-xs font-bold text-bark-muted md:grid md:grid-cols-[5rem_1fr_2fr_auto]">
            <span>{t.order}</span><span>{t.label}</span><span>{t.description}</span><span />
          </div>
          <ul className="mb-4 flex flex-col gap-2">{list.data.map(c => <Row key={c.slug} kind={kind} c={c} />)}</ul>
          {list.data.some(c => !c.is_active) && <Badge tone="neutral" className="mb-4">{t.inactiveNote}</Badge>}
          <AddCategory kind={kind} />
        </>
      )}
    </div>
  );
};
export default Categories;
