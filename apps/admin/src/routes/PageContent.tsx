import { pageContentKeyList, pageContentKeys, parsePageContentData, type PageContentKey } from '@nurserylink/shared';
import { Button, ErrorState, Field, Input, SkeletonList, Textarea, cn, formatDateTime, toast } from '@nurserylink/ui';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminPageContent, useSavePageContent, type PageContent as Block } from '../features/content/api';
import { toastError } from '../lib/errors';
import { useParam } from '../lib/params';

const t = en.pageContent;

type Steps = { title: string; body: string }[];
const asText = (v: unknown) => (typeof v === 'string' ? v : '');
type Contact = { phone: string; email: string; whatsapp: string };

const asSteps = (data: Record<string, unknown>): Steps =>
  Array.isArray(data.steps) ? (data.steps as { title?: unknown; body?: unknown }[]).map(s => ({ title: asText(s.title), body: asText(s.body) })) : [];

/**
 * One block of site copy. Title, subtitle and body are free text (the Donate page body is Markdown);
 * How It Works has its steps, the hero its small top line, and the contact block its numbers.
 */
const Editor = ({ k, block }: { k: PageContentKey; block: Block | undefined }) => {
  const save = useSavePageContent();
  const data = block?.data ?? {};
  const [title, setTitle] = useState(block?.title ?? '');
  const [subtitle, setSubtitle] = useState(block?.subtitle ?? '');
  const [body, setBody] = useState(block?.body ?? '');
  const [steps, setSteps] = useState<Steps>(asSteps(data));
  const [eyebrow, setEyebrow] = useState(asText(data.eyebrow));
  const [contact, setContact] = useState<Contact>({ phone: asText(data.phone), email: asText(data.email), whatsapp: asText(data.whatsapp) });
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const structured =
      k === 'home.how_it_works' ? { steps }
      : k === 'home.hero' ? { eyebrow }
      : k === 'site.contact' ? { phone: contact.phone.trim() || null, email: contact.email.trim() || null, whatsapp: contact.whatsapp.trim() || null }
      : {};
    const parsed = parsePageContentData(k, structured);
    if (!parsed.ok) { setError(parsed.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' · ')); return; }
    setError(null);
    save.mutate(
      { key: k, body: { title: title.trim() || null, subtitle: subtitle.trim() || null, body: body.trim() || null, data: parsed.data } },
      { onSuccess: () => { toast.success(en.common.changesSaved); }, onError: toastError }
    );
  };

  return (
    <form noValidate className="flex flex-col gap-3 rounded-lg bg-paper p-4 shadow-card ring-1 ring-line" onSubmit={e => { e.preventDefault(); submit(); }}>
      <h2 className="text-lg">{pageContentKeys[k].label}</h2>
      {block && <p className="text-xs text-bark-muted">{t.updated(formatDateTime(block.updated_at))}</p>}
      {error && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 text-sm font-bold text-laterite">{error}</p>}
      {k === 'home.hero' && <Field label={t.eyebrow}>{({ id }) => <Input id={id} value={eyebrow} onChange={e => { setEyebrow(e.target.value); }} />}</Field>}
      <Field label={t.titleLabel}>{({ id }) => <Input id={id} value={title} onChange={e => { setTitle(e.target.value); }} />}</Field>
      {k !== 'site.contact' && k !== 'home.how_it_works' && (
        <Field label={t.subtitle}>{({ id }) => <Input id={id} value={subtitle} onChange={e => { setSubtitle(e.target.value); }} />}</Field>
      )}
      {k !== 'site.contact' && k !== 'home.how_it_works' && (
        <Field label={t.body} hint={k.startsWith('donate.') ? t.markdownHint : t.paragraphHint}>
          {({ id, describedBy }) => <Textarea id={id} rows={k === 'donate.page' ? 24 : 8} aria-describedby={describedBy} value={body} onChange={e => { setBody(e.target.value); }} />}
        </Field>
      )}
      {k === 'home.how_it_works' && (
        <fieldset className="flex flex-col gap-3">
          <legend className="font-bold">{t.steps}</legend>
          {steps.map((s, i) => (
            <div key={i} className="grid gap-2 rounded-md bg-mist p-3 md:grid-cols-[1fr_2fr]">
              <Input aria-label={t.stepTitle(i + 1)} value={s.title} onChange={e => { setSteps(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x))); }} />
              <Textarea aria-label={t.stepBody(i + 1)} rows={2} value={s.body} onChange={e => { setSteps(steps.map((x, j) => (j === i ? { ...x, body: e.target.value } : x))); }} />
            </div>
          ))}
        </fieldset>
      )}
      {k === 'site.contact' && (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t.phone}>{({ id }) => <Input id={id} type="tel" value={contact.phone} onChange={e => { setContact({ ...contact, phone: e.target.value }); }} />}</Field>
          <Field label={t.whatsapp}>{({ id }) => <Input id={id} type="tel" value={contact.whatsapp} onChange={e => { setContact({ ...contact, whatsapp: e.target.value }); }} />}</Field>
          <Field label={t.email}>{({ id }) => <Input id={id} type="email" value={contact.email} onChange={e => { setContact({ ...contact, email: e.target.value }); }} />}</Field>
        </div>
      )}
      <Button type="submit" size="sm" className="self-start" busy={save.isPending}>{en.common.save}</Button>
    </form>
  );
};

/** The site's copy (hero, page introductions, Donate text, contacts, payment instructions), editable without developers. */
const PageContent = () => {
  const list = useAdminPageContent();
  const [key, setKey] = useParam('key');
  const current = pageContentKeyList.find(k => k === key) ?? 'home.hero';
  const block = list.data?.find(b => b.key === current);
  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} intro={t.intro} />
      {list.isPending && <SkeletonList rows={4} />}
      {list.isError && <ErrorState title={en.common.loadFailed} onRetry={() => { void list.refetch(); }} retryLabel={en.common.retry} />}
      {list.data && (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <nav aria-label={t.title} className="flex flex-col gap-1">
            {pageContentKeyList.map(k => (
              <button
                key={k}
                type="button"
                aria-current={current === k ? 'true' : undefined}
                onClick={() => { setKey(k); }}
                className={cn('min-h-9 rounded-sm px-3 text-left text-sm font-bold', current === k ? 'bg-forest text-paper' : 'text-forest hover:bg-forest-tint')}
              >
                {pageContentKeys[k].label}
              </button>
            ))}
          </nav>
          <Editor key={`${current}-${block?.updated_at ?? ''}`} k={current} block={block} />
        </div>
      )}
    </div>
  );
};
export default PageContent;
