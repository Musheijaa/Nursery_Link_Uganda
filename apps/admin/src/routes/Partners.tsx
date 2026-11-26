import { partnerCreateSchema } from '@nurserylink/shared';
import { Button, Checkbox, ErrorState, Field, Input, SkeletonList, toast } from '@nurserylink/ui';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminPartners, useDeletePartner, useSavePartner, type Partner } from '../features/content/api';
import { useUploadMedia } from '../features/species/api';
import { toastError } from '../lib/errors';
import { mediaSrc } from '../lib/media';

const t = en.partners;

/** One partner: name, logo (uploaded and converted to WebP), website, order and whether it's shown. */
const PartnerEditor = ({ p, onDone }: { p: Partner | null; onDone?: () => void }) => {
  const save = useSavePartner(p?.id ?? null);
  const remove = useDeletePartner();
  const upload = useUploadMedia();
  const [name, setName] = useState(p?.name ?? '');
  const [logo, setLogo] = useState<string | null>(p?.logo_url ?? null);
  const [website, setWebsite] = useState(p?.website_url ?? '');
  const [order, setOrder] = useState(String(p?.sort_order ?? 0));
  const [active, setActive] = useState(p?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = partnerCreateSchema.safeParse({ name, logo_url: logo, website_url: website.trim() || null, sort_order: Number(order) || 0, is_active: active });
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
    <form noValidate className="grid gap-3 rounded-lg bg-paper p-4 shadow-card ring-1 ring-line md:grid-cols-[8rem_1fr]" onSubmit={e => { e.preventDefault(); submit(); }}>
      <div className="flex flex-col items-start gap-2">
        <div className="flex aspect-[3/2] w-32 items-center justify-center rounded-md bg-mist p-2 ring-1 ring-line">
          {logo ? <img src={mediaSrc(logo)} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-center text-xs text-bark-muted">{t.noLogo}</span>}
        </div>
        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-sm border border-forest px-3 text-sm font-bold text-forest hover:bg-forest-tint">
          <ImagePlus aria-hidden className="size-4" />
          {upload.isPending ? t.uploading : t.upload}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={upload.isPending}
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) upload.mutate(file, { onSuccess: m => { setLogo(m.url); }, onError: toastError });
            }}
          />
        </label>
        {logo && <Button size="sm" variant="ghost" onClick={() => { setLogo(null); }}>{t.removeLogo}</Button>}
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-[1fr_6rem]">
          <Field label={t.name} error={errors.name}>{({ id, describedBy, invalid }) => <Input id={id} value={name} onChange={e => { setName(e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
          <Field label={t.order}>{({ id }) => <Input id={id} inputMode="numeric" value={order} onChange={e => { setOrder(e.target.value); }} />}</Field>
        </div>
        <Field label={t.website} error={errors.website_url}>{({ id, describedBy, invalid }) => <Input id={id} type="url" placeholder="https://" value={website} onChange={e => { setWebsite(e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox label={t.shown} checked={active} onChange={e => { setActive(e.target.checked); }} />
          <Button type="submit" size="sm" busy={save.isPending}>{p ? en.common.save : en.common.create}</Button>
          {p && (
            <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => { remove.mutate(p.id, { onSuccess: () => { toast.success(en.common.deleted); }, onError: toastError }); }}>
              <Trash2 aria-hidden />{en.common.delete}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};

/** Partner and supporter logos for Home's grid (five places; empty ones show a "Partner Logo" placeholder). */
const Partners = () => {
  const list = useAdminPartners();
  const [adding, setAdding] = useState(false);
  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} intro={t.intro} actions={!adding && <Button size="sm" onClick={() => { setAdding(true); }}><Plus aria-hidden />{t.add}</Button>} />
      {list.isPending && <SkeletonList rows={3} />}
      {list.isError && <ErrorState title={en.common.loadFailed} onRetry={() => { void list.refetch(); }} retryLabel={en.common.retry} />}
      {list.data?.length === 0 && !adding && <p className="text-bark-muted">{t.empty}</p>}
      <div className="flex flex-col gap-4">
        {adding && <PartnerEditor p={null} onDone={() => { setAdding(false); }} />}
        {list.data?.map(p => <PartnerEditor key={`${p.id}-${p.name}-${p.logo_url ?? ''}`} p={p} />)}
      </div>
    </div>
  );
};
export default Partners;
