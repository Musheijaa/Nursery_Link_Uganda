import { zodResolver } from '@hookform/resolvers/zod';
import { growthPaces, speciesCategories, speciesCreateSchema } from '@nurserylink/shared';
import { Button, ErrorState, Field, Input, Select, SkeletonList, Textarea, toast } from '@nurserylink/ui';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import type { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminSpeciesOne, useSaveSpecies, useUploadMedia } from '../features/species/api';
import { toastError } from '../lib/errors';
import { applyApiError } from '../lib/forms';
import { mediaSrc } from '../lib/media';

type Input = z.input<typeof speciesCreateSchema>;
type Output = z.output<typeof speciesCreateSchema>;

const Section = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => (
  <fieldset className="flex min-w-0 flex-col gap-2 rounded-lg bg-paper shadow-card p-4 ring-1 ring-line">
    <legend className="sr-only">{title}</legend>
    <div className="flex items-center justify-between"><p className="font-bold">{title}</p>{action}</div>
    {children}
  </fieldset>
);

/** Add or edit a Tree library species, including its local names and photos. */
const SpeciesForm = () => {
  const { id = null } = useParams();
  const editing = id !== null && id !== 'new';
  const existing = useAdminSpeciesOne(editing ? id : null);
  const save = useSaveSpecies(editing ? id : null);
  const upload = useUploadMedia();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<Input, unknown, Output>({
    resolver: zodResolver(speciesCreateSchema),
    defaultValues: { category: 'indigenous', growth_pace: 'moderate', height_timeline: [], ecological_zones: [], local_names: [], media: [] },
  });
  const timeline = useFieldArray({ control, name: 'height_timeline' });
  const names = useFieldArray({ control, name: 'local_names' });
  const media = useFieldArray({ control, name: 'media' });

  useEffect(() => {
    const s = existing.data;
    if (!s) return;
    reset({
      common_name: s.common_name, scientific_name: s.scientific_name, slug: s.slug, category: s.category, growth_pace: s.growth_pace,
      height_timeline: s.height_timeline, canopy_notes: s.canopy_notes ?? '', root_notes: s.root_notes ?? '', ecological_zones: s.ecological_zones,
      local_names: s.local_names, media: s.media.map(m => ({ url: m.url, caption: m.caption ?? '' })),
    });
  }, [existing.data, reset]);

  if (editing && existing.isPending) return <SkeletonList rows={4} />;
  if (editing && !existing.data) return <ErrorState title={en.common.loadFailed} onRetry={() => { void existing.refetch(); }} retryLabel={en.common.retry} />;

  const numberInput = (name: `height_timeline.${number}.years` | `height_timeline.${number}.height_m`, label: string) => (
    <input aria-label={label} inputMode="decimal" className="h-9 w-20 rounded-sm border border-field bg-paper px-2 text-sm" {...register(name, { valueAsNumber: true })} />
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title={existing.data ? en.species.editTitle(existing.data.common_name) : en.species.newTitle} actions={<Button asChild size="sm" variant="ghost"><Link to="/species">{en.common.back}</Link></Button>} />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={e => {
          setFormError(null);
          void handleSubmit(values => {
            const body = { ...values, canopy_notes: values.canopy_notes || null, root_notes: values.root_notes || null, media: values.media.map(m => ({ url: m.url, caption: m.caption || null })) };
            save.mutate(body, {
              onSuccess: s => { toast.success(editing ? en.common.changesSaved : en.species.created); void navigate(`/species/${s.id}`, { replace: true }); },
              onError: err => { setFormError(applyApiError(err, setError, ['common_name', 'scientific_name', 'slug'])); },
            });
          })(e);
        }}
      >
        {formError && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{formError}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={en.species.commonName} error={errors.common_name?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} aria-describedby={describedBy} invalid={invalid} {...register('common_name')} />}</Field>
          <Field label={en.species.scientificName} error={errors.scientific_name?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} className="font-serif italic" aria-describedby={describedBy} invalid={invalid} {...register('scientific_name')} />}</Field>
          <Field label={en.species.slug} hint={en.species.slugHint} error={errors.slug?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} aria-describedby={describedBy} invalid={invalid} {...register('slug', { setValueAs: (v: string) => (v ? v : undefined) })} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={en.species.category}>{({ id: f }) => <Select id={f} {...register('category')}>{speciesCategories.map(c => <option key={c} value={c}>{en.species.categories[c]}</option>)}</Select>}</Field>
            <Field label={en.species.pace}>{({ id: f }) => <Select id={f} {...register('growth_pace')}>{growthPaces.map(p => <option key={p} value={p}>{en.species.paces[p]}</option>)}</Select>}</Field>
          </div>
        </div>

        <Section title={en.species.timeline} action={<Button size="sm" variant="secondary" onClick={() => { timeline.append({ years: 1, height_m: 1 }); }}><Plus aria-hidden />{en.common.add}</Button>}>
          {timeline.fields.map((f, i) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
              {numberInput(`height_timeline.${i}.years`, `${en.species.years} ${String(i + 1)}`)}<span>{en.species.years}</span>
              {numberInput(`height_timeline.${i}.height_m`, `${en.species.height} ${String(i + 1)}`)}<span>{en.species.heightUnit}</span>
              <Button size="sm" variant="ghost" aria-label={`${en.common.remove} ${String(i + 1)}`} onClick={() => { timeline.remove(i); }}><Trash2 aria-hidden /></Button>
            </div>
          ))}
          {errors.height_timeline && <p role="alert" className="text-sm font-bold text-laterite">{en.common.required}</p>}
        </Section>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label={en.species.canopy}>{({ id: f }) => <Textarea id={f} {...register('canopy_notes')} />}</Field>
          <Field label={en.species.roots}>{({ id: f }) => <Textarea id={f} {...register('root_notes')} />}</Field>
        </div>
        <Controller
          control={control}
          name="ecological_zones"
          render={({ field }) => (
            <Field label={en.species.zones} hint={en.species.zonesHint}>
              {({ id: f, describedBy }) => (
                <Textarea id={f} aria-describedby={describedBy} value={(field.value ?? []).join('\n')} onChange={e => { field.onChange(e.target.value.split('\n').map(z => z.trim()).filter(Boolean)); }} />
              )}
            </Field>
          )}
        />

        <Section title={en.species.localNames} action={<Button size="sm" variant="secondary" onClick={() => { names.append({ language: '', name: '' }); }}><Plus aria-hidden />{en.common.add}</Button>}>
          {names.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              <input aria-label={`${en.species.language} ${String(i + 1)}`} placeholder={en.species.language} className="h-9 w-28 min-w-0 rounded-sm sm:w-40 border border-field bg-paper px-2 text-sm" {...register(`local_names.${i}.language`)} />
              <input aria-label={`${en.species.localName} ${String(i + 1)}`} placeholder={en.species.localName} className="h-9 min-w-0 flex-1 rounded-sm border border-field bg-paper px-2 text-sm" {...register(`local_names.${i}.name`)} />
              <Button size="sm" variant="ghost" aria-label={`${en.common.remove} ${String(i + 1)}`} onClick={() => { names.remove(i); }}><Trash2 aria-hidden /></Button>
            </div>
          ))}
          {errors.local_names && <p role="alert" className="text-sm font-bold text-laterite">{errors.local_names.message ?? en.common.required}</p>}
        </Section>

        <Section
          title={en.species.media}
          action={
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-sm border border-forest px-3 text-sm font-bold text-forest hover:bg-forest-tint">
              <ImagePlus aria-hidden className="size-4" />
              {upload.isPending ? en.species.uploading : en.species.upload}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={upload.isPending}
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  upload.mutate(file, { onSuccess: m => { media.append({ url: m.url, caption: '' }); toast.success(en.species.uploaded); }, onError: toastError });
                }}
              />
            </label>
          }
        >
          {media.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3">
              <img src={mediaSrc(f.url)} alt="" width={64} height={48} className="h-12 w-16 shrink-0 rounded-sm object-cover ring-1 ring-line" />
              <input aria-label={`${en.species.caption} ${String(i + 1)}`} placeholder={en.species.caption} className="h-9 min-w-0 flex-1 rounded-sm border border-field bg-paper px-2 text-sm" {...register(`media.${i}.caption`)} />
              <Button size="sm" variant="ghost" aria-label={`${en.common.remove} ${String(i + 1)}`} onClick={() => { media.remove(i); }}><Trash2 aria-hidden /></Button>
            </div>
          ))}
        </Section>

        <Button type="submit" busy={save.isPending} className="self-start">{en.common.save}</Button>
      </form>
    </div>
  );
};
export default SpeciesForm;
