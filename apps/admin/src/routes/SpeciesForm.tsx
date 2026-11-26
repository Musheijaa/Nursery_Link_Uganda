import { zodResolver } from '@hookform/resolvers/zod';
import { growthPaces, speciesCreateSchema, speciesProfileSections, type SpeciesProfileField } from '@nurserylink/shared';
import { Button, Checkbox, ErrorState, Field, Input, Select, SkeletonList, Textarea, toast } from '@nurserylink/ui';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import type { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminSpeciesOne, useSaveSpecies, useUploadMedia } from '../features/species/api';
import { useAdminCategories } from '../features/content/api';
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

/** One of the five sections of the public species page, grouping its fields */
const ProfileGroup = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
  <section className="flex min-w-0 flex-col gap-3 rounded-lg border-l-4 border-forest bg-mist/60 p-4">
    <h2 className="text-lg">{n}. {title}</h2>
    {children}
  </section>
);

const textOf = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * What visitors will see: the five sections with only the fields that have text. Sections with
 * nothing written are hidden on the site, and marked as such here.
 */
const Preview = ({ control }: { control: Control<Input, unknown, Output> }) => {
  const values = useWatch({ control });
  return (
    <aside aria-labelledby="preview" className="flex flex-col gap-3 self-start rounded-md border-l-4 border-forest bg-paper p-4 ring-1 ring-line xl:sticky xl:top-4">
      <h2 id="preview" className="text-base">{en.species.previewHeading}</h2>
      <p className="text-xs text-bark-muted">{en.species.previewNote}</p>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold">{textOf(values.common_name) || '…'}</p>
        <p className="font-serif text-bark-muted italic">{textOf(values.scientific_name)}</p>
        {textOf(values.botanical_family) && <p className="text-sm">{en.species.fields.botanical_family}: {textOf(values.botanical_family)}</p>}
      </div>
      {speciesProfileSections.filter(sec => sec.key !== 'identity').map(sec => {
        const filled = sec.fields.filter(f => textOf(values[f]));
        const chart = sec.key === 'about' && (values.height_timeline?.length ?? 0) > 0;
        return (
          <div key={sec.key} className="flex flex-col gap-1 border-t border-line pt-2">
            <p className="font-bold text-canopy">{en.species.sections[sec.key]}</p>
            {filled.length === 0 && !chart ? (
              <p className="text-xs text-bark-muted italic">{en.species.sectionHidden}</p>
            ) : (
              <>
                {filled.map(f => (
                  <p key={f} className="text-xs"><span className="font-bold">{en.species.fields[f]}: </span>{textOf(values[f])}</p>
                ))}
                {chart && <p className="text-xs text-bark-muted">{en.species.chartShown}</p>}
              </>
            )}
          </div>
        );
      })}
    </aside>
  );
};

/** Add or edit a Tree library species, including its local names and photos. */
const SpeciesForm = () => {
  const { id = null } = useParams();
  const editing = id !== null && id !== 'new';
  const existing = useAdminSpeciesOne(editing ? id : null);
  const save = useSaveSpecies(editing ? id : null);
  const upload = useUploadMedia();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const categories = useAdminCategories('tree');
  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<Input, unknown, Output>({
    resolver: zodResolver(speciesCreateSchema),
    defaultValues: { categories: [], growth_pace: 'moderate', height_timeline: [], ecological_zones: [], local_names: [], media: [] },
  });
  const timeline = useFieldArray({ control, name: 'height_timeline' });
  const names = useFieldArray({ control, name: 'local_names' });
  const media = useFieldArray({ control, name: 'media' });

  useEffect(() => {
    const s = existing.data;
    if (!s) return;
    const profile = Object.fromEntries(speciesProfileSections.flatMap(sec => sec.fields).map(f => [f, s[f] ?? ''])) as Record<SpeciesProfileField, string>;
    reset({
      common_name: s.common_name, scientific_name: s.scientific_name, slug: s.slug, categories: s.categories.map(c => c.slug), growth_pace: s.growth_pace,
      height_timeline: s.height_timeline, ecological_zones: s.ecological_zones, ...profile,
      local_names: s.local_names, media: s.media.map(m => ({ url: m.url, caption: m.caption ?? '' })),
    });
  }, [existing.data, reset]);

  if (editing && existing.isPending) return <SkeletonList rows={4} />;
  if (editing && !existing.data) return <ErrorState title={en.common.loadFailed} onRetry={() => { void existing.refetch(); }} retryLabel={en.common.retry} />;

  const text = (f: SpeciesProfileField, rows = 3) => (
    <Field key={f} label={en.species.fields[f]} error={errors[f]?.message}>
      {({ id: fid, describedBy, invalid }) => <Textarea id={fid} rows={rows} aria-describedby={describedBy} invalid={invalid} {...register(f)} />}
    </Field>
  );

  const numberInput = (name: `height_timeline.${number}.years` | `height_timeline.${number}.height_m`, label: string) => (
    <input aria-label={label} inputMode="decimal" className="h-9 w-20 rounded-sm border border-field bg-paper px-2 text-sm" {...register(name, { valueAsNumber: true })} />
  );

  return (
    <div className="max-w-6xl">
      <PageHeader title={existing.data ? en.species.editTitle(existing.data.common_name) : en.species.newTitle} actions={<Button asChild size="sm" variant="ghost"><Link to="/species">{en.common.back}</Link></Button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <form
        noValidate
        className="flex min-w-0 flex-col gap-4"
        onSubmit={e => {
          setFormError(null);
          void handleSubmit(values => {
            // Blank profile fields are stored as empty, so the site hides them
            const profile = Object.fromEntries(speciesProfileSections.flatMap(sec => sec.fields).map(f => [f, values[f]?.trim() ? values[f] : null]));
            const body = { ...values, ...profile, media: values.media.map(m => ({ url: m.url, caption: m.caption || null })) };
            save.mutate(body, {
              onSuccess: s => { toast.success(editing ? en.common.changesSaved : en.species.created); void navigate(`/species/${s.id}`, { replace: true }); },
              onError: err => { setFormError(applyApiError(err, setError, ['common_name', 'scientific_name', 'slug'])); },
            });
          })(e);
        }}
      >
        {formError && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{formError}</p>}
        <ProfileGroup n={1} title={en.species.sections.identity}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={en.species.commonName} error={errors.common_name?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} aria-describedby={describedBy} invalid={invalid} {...register('common_name')} />}</Field>
          <Field label={en.species.scientificName} error={errors.scientific_name?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} className="font-serif italic" aria-describedby={describedBy} invalid={invalid} {...register('scientific_name')} />}</Field>
          <Field label={en.species.slug} hint={en.species.slugHint} error={errors.slug?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} aria-describedby={describedBy} invalid={invalid} {...register('slug', { setValueAs: (v: string) => (v ? v : undefined) })} />}</Field>
          <Field label={en.species.fields.botanical_family} error={errors.botanical_family?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} aria-describedby={describedBy} invalid={invalid} {...register('botanical_family')} />}</Field>
          <Field label={en.species.pace}>{({ id: f }) => <Select id={f} {...register('growth_pace')}>{growthPaces.map(p => <option key={p} value={p}>{en.species.paces[p]}</option>)}</Select>}</Field>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-bold">{en.species.categoriesLabel}</legend>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.data?.map(c => <Checkbox key={c.slug} value={c.slug} label={c.is_active ? c.label : `${c.label} (${en.common.inactive})`} {...register('categories')} />)}
          </div>
          {errors.categories && <p role="alert" className="text-sm font-bold text-laterite">{errors.categories.message ?? en.common.required}</p>}
        </fieldset>

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

        </ProfileGroup>

        <ProfileGroup n={2} title={en.species.sections.about}>
          {(['appearance_and_identification', 'growth_characteristics', 'distribution_and_origin'] as const).map(f => text(f))}
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

        </ProfileGroup>

        <ProfileGroup n={3} title={en.species.sections.where}>
          {(['soil_conditions', 'rainfall_requirements', 'climate_and_ecology'] as const).map(f => text(f))}
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

        </ProfileGroup>

        <ProfileGroup n={4} title={en.species.sections.grow}>
          {(['propagation_methods', 'planting_requirements', 'recommended_spacing', 'management_practices'] as const).map(f => text(f))}
        </ProfileGroup>

        <ProfileGroup n={5} title={en.species.sections.uses}>
          {(['economic_uses', 'environmental_benefits', 'agroforestry_applications', 'other_uses'] as const).map(f => text(f))}
        </ProfileGroup>

        <Button type="submit" busy={save.isPending} className="self-start">{en.common.save}</Button>
      </form>
      <Preview control={control} />
      </div>
    </div>
  );
};
export default SpeciesForm;
