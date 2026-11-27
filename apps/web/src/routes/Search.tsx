import { isApiError } from '@nurserylink/api-client';
import { EmptyState, ErrorState, Input, SkeletonList } from '@nurserylink/ui';
import { BookOpen, Gift, Map as MapIcon, Newspaper, Search as SearchIcon, Sprout, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useSiteSearch, type SearchResults } from '../features/search/api';
import { useDebounced } from '../lib/useDebounced';

const t = en.siteSearch;

const GROUPS: { key: keyof SearchResults; title: string; icon: LucideIcon }[] = [
  { key: 'nurseries', title: en.nav.nurseries, icon: MapIcon },
  { key: 'species', title: en.nav.library, icon: BookOpen },
  { key: 'services', title: en.nav.expertServices, icon: Sprout },
  { key: 'news', title: en.nav.news, icon: Newspaper },
  { key: 'giveaways', title: en.nav.giveaways, icon: Gift },
];

/**
 * Search the whole site (brief §10.3): nurseries (by name, tree in stock, or place), trees, expert
 * services, news and giveaways, grouped, the best five of each. Spelling mistakes are forgiven.
 * The header's search button opens this page; on phones it's the search screen.
 */
const Search = () => {
  usePageTitle(t.title);
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const q = useDebounced(text.trim(), 250);
  const search = useSiteSearch(q);
  const input = useRef<HTMLInputElement>(null);

  // The search box takes focus when the page opens (it's what the person came to do)
  useEffect(() => { input.current?.focus(); }, []);
  // Keep the address shareable without filling the back button
  useEffect(() => {
    setParams(q ? { q } : {}, { replace: true });
  }, [q, setParams]);

  const results = search.data?.data;
  const total = results ? GROUPS.reduce((n, g) => n + results[g.key].length, 0) : 0;
  const offline = isApiError(search.error) && search.error.isOffline;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-h1">{t.title}</h1>
      <form role="search" onSubmit={e => { e.preventDefault(); }} className="relative">
        <label htmlFor="site-search" className="sr-only">{t.label}</label>
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-bark-muted" />
        <Input ref={input} id="site-search" type="search" className="pl-11 text-lg" placeholder={t.placeholder} value={text} onChange={e => { setText(e.target.value); }} />
      </form>

      {q.length < 2 && <p className="text-bark-muted">{t.hint}</p>}
      {q.length >= 2 && search.isPending && <SkeletonList rows={4} label={t.title} />}
      {search.isError && !results && (
        <ErrorState title={offline ? en.states.offlineNoCache : t.failed} offline={offline} onRetry={() => { void search.refetch(); }} retryLabel={en.states.retry} />
      )}
      {results && q.length >= 2 && (
        <>
          <p aria-live="polite" className="text-sm text-bark-muted">{t.count(total, q)}</p>
          {total === 0 ? (
            <EmptyState title={t.emptyTitle}>{t.emptyBody}</EmptyState>
          ) : (
            GROUPS.filter(g => results[g.key].length > 0).map(({ key, title, icon: Icon }) => (
              <section key={key} aria-labelledby={`results-${key}`} className="flex flex-col gap-2">
                <h2 id={`results-${key}`} className="flex items-center gap-2 text-h4">
                  <Icon aria-hidden className="size-5 text-forest" />
                  {title}
                </h2>
                <ul className="flex flex-col divide-y divide-line rounded-lg bg-paper shadow-card ring-1 ring-line">
                  {results[key].map(r => (
                    <li key={r.id}>
                      <Link to={r.link} className="flex min-h-14 flex-col justify-center px-4 py-2 no-underline hover:bg-forest-tint">
                        <span className="font-bold text-canopy">{r.title}</span>
                        {r.subtitle && <span className="text-sm text-bark-muted">{r.subtitle}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
};
export default Search;
