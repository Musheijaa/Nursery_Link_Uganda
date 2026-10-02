import { zodResolver } from '@hookform/resolvers/zod';
import { newsCategories, newsCreateSchema } from '@nurserylink/shared';
import { Button, Checkbox, ErrorState, Field, Input, Select, SkeletonList, Textarea, cn, toast } from '@nurserylink/ui';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import type { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminNewsOne, useSaveNews } from '../features/news/api';
import { Markdown } from '../features/news/Markdown';
import { applyApiError } from '../lib/forms';

type Input = z.input<typeof newsCreateSchema>;
type Output = z.output<typeof newsCreateSchema>;

// <input type="datetime-local"> works in local time without a zone; the API wants ISO with an offset
const toLocalInput = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

/** Write or edit a post in Markdown, with a live preview. */
const NewsForm = () => {
  const { id = null } = useParams();
  const editing = id !== null && id !== 'new';
  const existing = useAdminNewsOne(editing ? id : null);
  const save = useSaveNews(editing ? id : null);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [formError, setFormError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<Input, unknown, Output>({
    resolver: zodResolver(newsCreateSchema),
    defaultValues: { category: 'weather', is_published: false, body: '', cover_url: '' },
  });
  const body = useWatch({ control, name: 'body' });

  useEffect(() => {
    const n = existing.data;
    if (n) reset({ title: n.title, slug: n.slug, category: n.category, body: n.body, cover_url: n.cover_url ?? '', is_published: n.is_published, published_at: n.published_at ?? undefined });
  }, [existing.data, reset]);

  if (editing && existing.isPending) return <SkeletonList rows={4} />;
  if (editing && !existing.data) return <ErrorState title={en.common.loadFailed} onRetry={() => { void existing.refetch(); }} retryLabel={en.common.retry} />;

  const tabClass = (on: boolean) => cn('min-h-9 rounded-sm px-3 text-sm font-bold', on ? 'bg-forest text-paper' : 'text-forest hover:bg-forest-tint');
  return (
    <div className="max-w-4xl">
      <PageHeader title={editing ? en.news.editTitle : en.news.newTitle} actions={<Button asChild size="sm" variant="ghost"><Link to="/news">{en.common.back}</Link></Button>} />
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={e => {
          setFormError(null);
          void handleSubmit(values => {
            save.mutate({ ...values, cover_url: values.cover_url || null }, {
              onSuccess: n => { toast.success(en.news.created); void navigate(`/news/${n.id}`, { replace: true }); },
              onError: err => { setFormError(applyApiError(err, setError, ['title', 'slug', 'body'])); },
            });
          })(e);
        }}
      >
        {formError && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{formError}</p>}
        <Field label={en.news.postTitle} error={errors.title?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} aria-describedby={describedBy} invalid={invalid} {...register('title')} />}</Field>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={en.news.category}>{({ id: f }) => <Select id={f} {...register('category')}>{newsCategories.map(c => <option key={c} value={c}>{en.news.categories[c]}</option>)}</Select>}</Field>
          <Field label={en.news.publishAt}>
            {({ id: f }) => <Input id={f} type="datetime-local" {...register('published_at', { setValueAs: (v: string) => fromLocalInput(v) })} defaultValue={toLocalInput(existing.data?.published_at)} />}
          </Field>
          <Checkbox label={en.news.publish} className="self-end" {...register('is_published')} />
        </div>
        <Field label={en.news.cover}>{({ id: f }) => <Input id={f} {...register('cover_url')} />}</Field>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-bold">{en.news.body}</span>
            <div role="tablist" className="flex gap-1">
              <button type="button" role="tab" aria-selected={tab === 'write'} className={tabClass(tab === 'write')} onClick={() => { setTab('write'); }}>{en.news.write}</button>
              <button type="button" role="tab" aria-selected={tab === 'preview'} className={tabClass(tab === 'preview')} onClick={() => { setTab('preview'); }}>{en.news.preview}</button>
            </div>
          </div>
          <p className="text-sm text-bark-muted">{en.news.bodyHint}</p>
          {tab === 'write' ? (
            <Textarea aria-label={en.news.body} className="min-h-80 font-mono text-sm" invalid={Boolean(errors.body)} {...register('body')} />
          ) : (
            <div role="tabpanel" className="min-h-80 rounded-sm bg-paper p-4 ring-1 ring-line"><Markdown source={body} /></div>
          )}
          {errors.body && <p role="alert" className="text-sm font-bold text-laterite">{errors.body.message}</p>}
        </div>
        <Button type="submit" busy={save.isPending} className="self-start">{en.common.save}</Button>
      </form>
    </div>
  );
};
export default NewsForm;
