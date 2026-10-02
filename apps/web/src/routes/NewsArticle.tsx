import { isApiError } from '@nurserylink/api-client';
import { ErrorState, SkeletonList, formatDate } from '@nurserylink/ui';
import { NewsPill } from '../components/Pills';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { CachedNote } from '../components/CachedNote';
import { Picture } from '../components/Picture';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useNewsPost } from '../features/news/api';
import { Markdown } from '../features/news/Markdown';
import { NotFoundPage } from './NotFound';

/** A readable article: one narrow column, large text. */
const NewsArticle = () => {
  const { slug = '' } = useParams();
  const post = useNewsPost(slug);
  const p = post.data?.data;
  usePageTitle(p?.title ?? en.news.title);

  if (isApiError(post.error) && post.error.status === 404) return <NotFoundPage />;
  if (post.isPending) return <SkeletonList rows={3} label={en.news.title} />;
  if (!p) {
    const offline = isApiError(post.error) && post.error.isOffline;
    return <ErrorState title={offline ? en.states.offlineNoCache : en.news.loadFailed} offline={offline} onRetry={() => { void post.refetch(); }} retryLabel={en.states.retry} />;
  }

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link to={`/news?category=${p.category}`} className="flex min-h-11 items-center gap-2 self-start font-bold">
        <ArrowLeft aria-hidden className="size-5" />
        {en.news.back}
      </Link>
      {post.data && <CachedNote fromCache={post.data.fromCache} fetchedAt={post.data.fetchedAt} />}
      <header className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm">
          <NewsPill category={p.category} />
          <time dateTime={p.published_at} className="text-bark-muted">{formatDate(p.published_at)}</time>
        </p>
        <h1 className="text-2xl md:text-3xl">{p.title}</h1>
      </header>
      {p.cover_url && <Picture src={p.cover_url} alt="" width={960} height={540} sizes="(min-width: 672px) 672px, 100vw" priority className="aspect-video w-full rounded-md object-cover" />}
      <Markdown source={p.body} />
    </article>
  );
};
export default NewsArticle;
