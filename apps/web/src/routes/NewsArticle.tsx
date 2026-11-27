import { isApiError } from '@nurserylink/api-client';
import { Button, ErrorState, SkeletonList, formatDate } from '@nurserylink/ui';
import { NewsPill } from '../components/Pills';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { CachedNote } from '../components/CachedNote';
import { Picture } from '../components/Picture';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useNewsList, useNewsPost } from '../features/news/api';
import { Markdown } from '../features/news/Markdown';
import { NewsCard } from '../features/news/NewsCard';
import { postPhoto } from '../features/news/photos';
import { NotFoundPage } from './NotFound';

/** Where each kind of post leads next; categories added later lead to Find Nurseries */
const NEXT_STEP: Record<string, { to: string; copy: { title: string; body: string; cta: string } }> = {
  'policy-sector': { to: '/library', copy: en.news.nextStep.library },
  'weather-seasonal': { to: '/nurseries', copy: en.news.nextStep.nurseries },
  'planting-restoration': { to: '/giveaways', copy: en.news.nextStep.giveaways },
  'agroforestry-farming': { to: '/library', copy: en.news.nextStep.library },
  'training-events': { to: '/expert-services', copy: en.news.nextStep.services },
  'funding-partnerships': { to: '/giveaways', copy: en.news.nextStep.giveaways },
};
const DEFAULT_NEXT = { to: '/nurseries', copy: en.news.nextStep.nurseries };

/** Roughly 200 words a minute, at least one. */
const readingMinutes = (markdown: string) => Math.max(1, Math.round(markdown.split(/\s+/).filter(Boolean).length / 200));

/** A readable article: one narrow column, large text, then where to go next. */
const NewsArticle = () => {
  const { slug = '' } = useParams();
  const post = useNewsPost(slug);
  const latest = useNewsList(null, 1, 4);
  const more = (latest.data?.data ?? []).filter(m => m.slug !== slug).slice(0, 3);
  const p = post.data?.data;
  usePageTitle(p?.title ?? en.nav.news);

  if (isApiError(post.error) && post.error.status === 404) return <NotFoundPage />;
  if (post.isPending) return <SkeletonList rows={3} label={en.nav.news} />;
  if (!p) {
    const offline = isApiError(post.error) && post.error.isOffline;
    return <ErrorState title={offline ? en.states.offlineNoCache : en.news.loadFailed} offline={offline} onRetry={() => { void post.refetch(); }} retryLabel={en.states.retry} />;
  }

  const next = NEXT_STEP[p.category.slug] ?? DEFAULT_NEXT;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <article className="flex flex-col gap-5">
        <Link to={`/news?category=${p.category.slug}`} className="flex min-h-11 items-center gap-2 self-start font-bold">
          <ArrowLeft aria-hidden className="size-5" />
          {en.news.back}
        </Link>
        {post.data && <CachedNote fromCache={post.data.fromCache} fetchedAt={post.data.fetchedAt} />}
        <header className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-sm text-bark-muted">
            <NewsPill category={p.category} />
            <time dateTime={p.published_at}>{formatDate(p.published_at)}</time>
            <span aria-hidden>·</span>
            <span>{en.news.readingTime(readingMinutes(p.body))}</span>
          </p>
          <h1 className="text-3xl leading-tight md:text-4xl">{p.title}</h1>
        </header>
        <Picture src={postPhoto(p)} alt="" width={960} height={540} sizes="(min-width: 672px) 672px, 100vw" priority className="aspect-video w-full rounded-lg object-cover shadow-card" />
        <Markdown source={p.body} />
      </article>

      <aside aria-labelledby="next-step" className="flex flex-col items-start gap-3 rounded-lg border-l-4 border-murram bg-paper p-5 shadow-card ring-1 ring-line">
        <h2 id="next-step" className="text-xl">{next.copy.title}</h2>
        <p>{next.copy.body}</p>
        <Button asChild>
          <Link to={next.to} className="no-underline">{next.copy.cta}</Link>
        </Button>
      </aside>

      {more.length > 0 && (
        <section aria-labelledby="more-advice" className="flex flex-col gap-3">
          <h2 id="more-advice" className="text-2xl">{en.news.more}</h2>
          <ul className="flex flex-col gap-3">{more.map(m => <NewsCard key={m.id} post={m} />)}</ul>
        </section>
      )}
    </div>
  );
};
export default NewsArticle;
