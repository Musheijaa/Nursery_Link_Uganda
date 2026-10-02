import { isApiError } from '@nurserylink/api-client';
import { newsCategories, type NewsCategory } from '@nurserylink/shared';
import { Button, EmptyState, ErrorState, SkeletonList, cn } from '@nurserylink/ui';
import { ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { CachedNote } from '../components/CachedNote';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { NEWS_PAGE_SIZE, useNewsList } from '../features/news/api';
import { NewsCard } from '../features/news/NewsCard';
import { PlantingCalendar } from '../features/news/PlantingCalendar';
import { PageHero } from '../components/PageHero';

const chip = (on: boolean) =>
  cn('flex min-h-11 shrink-0 items-center rounded-full px-4 font-bold ring-1 transition-colors', on ? 'bg-canopy text-paper ring-canopy' : 'bg-paper text-canopy ring-line shadow-card hover:ring-forest');

/** News and sector advisories, filterable by category (FR-22). */
const News = () => {
  usePageTitle(en.news.title);
  const [params, setParams] = useSearchParams();
  const category = newsCategories.find(c => c === params.get('category')) ?? null;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const list = useNewsList(category, page);

  const go = (changes: { category?: NewsCategory | null; page?: number }) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if ('category' in changes) {
        if (changes.category) next.set('category', changes.category);
        else next.delete('category');
        next.delete('page');
      }
      if (changes.page !== undefined) {
        if (changes.page > 1) next.set('page', String(changes.page));
        else next.delete('page');
      }
      return next;
    });
  };

  const pages = list.data ? Math.max(1, Math.ceil(list.data.meta.total / NEWS_PAGE_SIZE)) : 1;
  const offline = isApiError(list.error) && list.error.isOffline;

  const posts = list.data?.data ?? [];
  const [lead, ...rest] = page === 1 ? posts : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHero title={en.news.title} intro={en.news.intro} photo="western-hills" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <div role="group" aria-label={en.library.filterLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <button type="button" aria-pressed={category === null} onClick={() => { go({ category: null }); }} className={chip(category === null)}>
              {en.news.all}
            </button>
            {newsCategories.map(c => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => { go({ category: c }); }} className={chip(category === c)}>
                {en.news.categories[c]}
              </button>
            ))}
          </div>

          {list.data && <CachedNote fromCache={list.data.fromCache} fetchedAt={list.data.fetchedAt} />}
          {list.isPending && <SkeletonList rows={4} label={en.news.title} />}
          {list.isError && !list.data && (
            <ErrorState title={offline ? en.states.offlineNoCache : en.news.loadFailed} offline={offline} onRetry={() => { void list.refetch(); }} retryLabel={en.states.retry} />
          )}
          {list.data && posts.length === 0 && (
            <EmptyState title={en.news.emptyTitle} action={category && <Button variant="secondary" onClick={() => { go({ category: null }); }}>{en.news.all}</Button>}>
              {en.news.emptyBody}
            </EmptyState>
          )}
          {posts.length > 0 && (
            <>
              <ul className="flex flex-col gap-3">
                {lead ? (
                  <>
                    <NewsCard post={lead} featured />
                    {rest.map(p => <NewsCard key={p.id} post={p} />)}
                  </>
                ) : posts.map(p => <NewsCard key={p.id} post={p} />)}
              </ul>
              {pages > 1 && (
                <nav aria-label={en.news.page(page, pages)} className="flex items-center justify-between gap-2">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => { go({ page: page - 1 }); }}>{en.news.newer}</Button>
                  <span className="text-sm text-bark-muted">{en.news.page(page, pages)}</span>
                  <Button variant="secondary" disabled={page >= pages} onClick={() => { go({ page: page + 1 }); }}>{en.news.older}</Button>
                </nav>
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <PlantingCalendar />
          <nav aria-labelledby="news-links" className="flex flex-col rounded-lg bg-paper p-5 shadow-card ring-1 ring-line">
            <h2 id="news-links" className="mb-1 text-xl">{en.news.links.heading}</h2>
            {([['/nurseries', en.news.links.nurseries], ['/free-seedlings', en.news.links.free], ['/library', en.news.links.library]] as const).map(([to, label]) => (
              <Link key={to} to={to} className="flex min-h-11 items-center justify-between gap-2 border-b border-line font-bold no-underline last:border-0 hover:underline">
                {label}
                <ArrowRight aria-hidden className="size-5 shrink-0 text-murram" />
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
};
export default News;
