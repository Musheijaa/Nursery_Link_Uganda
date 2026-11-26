import { serviceCategoryCreateSchema } from '@nurserylink/shared';
import { Button, Checkbox, ErrorState, Field, Input, Select, SkeletonList, Textarea, toast } from '@nurserylink/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminServices, useDeleteServiceCategory, useSaveServiceCategory, type ServiceCategory } from '../features/content/api';
import { toastError } from '../lib/errors';

const t = en.expertServices;
const ICONS = ['trees', 'sprout', 'map', 'leaf', 'chart', 'clipboard'] as const;

/**
 * One service area: title, introduction, icon, order, on/off, and its services (one per line; a line
 * starting with "-" is kept but hidden from the site).
 */
const CategoryEditor = ({ c, onDone }: { c: ServiceCategory | null; onDone?: () => void }) => {
  const save = useSaveServiceCategory(c?.id ?? null);
  const remove = useDeleteServiceCategory();
  const [title, setTitle] = useState(c?.title ?? '');
  const [intro, setIntro] = useState(c?.intro ?? '');
  const [icon, setIcon] = useState(c?.icon ?? 'leaf');
  const [order, setOrder] = useState(String(c?.sort_order ?? 100));
  const [active, setActive] = useState(c?.is_active ?? true);
  const [lines, setLines] = useState((c?.services ?? []).map(s => (s.is_active ? s.title : `- ${s.title}`)).join('\n'));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const services = lines.split('\n').map(l => l.trim()).filter(Boolean).map(l => (l.startsWith('-') ? { title: l.slice(1).trim(), is_active: false } : { title: l, is_active: true }));
    const parsed = serviceCategoryCreateSchema.safeParse({ title, intro, icon, sort_order: Number(order) || 0, is_active: active, services });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(parsed.data, { onSuccess: () => { toast.success(en.common.changesSaved); onDone?.(); }, onError: toastError });
  };

  return (
    <form noValidate className="flex flex-col gap-3 rounded-lg bg-paper p-4 shadow-card ring-1 ring-line" onSubmit={e => { e.preventDefault(); submit(); }}>
      <div className="grid gap-3 md:grid-cols-[1fr_10rem_6rem]">
        <Field label={t.areaTitle} error={errors.title}>{({ id, describedBy, invalid }) => <Input id={id} value={title} onChange={e => { setTitle(e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
        <Field label={t.icon}>{({ id }) => <Select id={id} value={icon} onChange={e => { setIcon(e.target.value); }}>{ICONS.map(i => <option key={i} value={i}>{t.icons[i]}</option>)}</Select>}</Field>
        <Field label={t.order}>{({ id }) => <Input id={id} inputMode="numeric" value={order} onChange={e => { setOrder(e.target.value); }} />}</Field>
      </div>
      <Field label={t.areaIntro} error={errors.intro}>{({ id, describedBy, invalid }) => <Textarea id={id} rows={2} value={intro} onChange={e => { setIntro(e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
      <Field label={t.services} hint={t.servicesHint} error={errors.services}>
        {({ id, describedBy, invalid }) => <Textarea id={id} rows={8} value={lines} onChange={e => { setLines(e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox label={t.shown} checked={active} onChange={e => { setActive(e.target.checked); }} />
        <Button type="submit" size="sm" busy={save.isPending}>{c ? en.common.save : en.common.create}</Button>
        {c && (
          <Button
            size="sm"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => { if (window.confirm(en.common.confirmDelete(c.title))) remove.mutate(c.id, { onSuccess: () => { toast.success(en.common.deleted); }, onError: toastError }); }}
          >
            <Trash2 aria-hidden />{en.common.delete}
          </Button>
        )}
      </div>
    </form>
  );
};

/** Expert Services: the areas of expertise and their services, as the public page shows them. */
const ExpertServices = () => {
  const list = useAdminServices();
  const [adding, setAdding] = useState(false);
  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} intro={t.intro} actions={!adding && <Button size="sm" onClick={() => { setAdding(true); }}><Plus aria-hidden />{t.add}</Button>} />
      {list.isPending && <SkeletonList rows={4} />}
      {list.isError && <ErrorState title={en.common.loadFailed} onRetry={() => { void list.refetch(); }} retryLabel={en.common.retry} />}
      <div className="flex flex-col gap-4">
        {adding && <CategoryEditor c={null} onDone={() => { setAdding(false); }} />}
        {list.data?.map(c => <CategoryEditor key={`${c.id}-${String(c.services.length)}-${c.title}`} c={c} />)}
      </div>
    </div>
  );
};
export default ExpertServices;
