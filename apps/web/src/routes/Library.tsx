import '@nurserylink/ui/library-fonts.css';
import { EmptyState, ErrorState, SkeletonList, cn } from '@nurserylink/ui';
import { isApiError } from '@nurserylink/api-client';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CachedNote } from '../components/CachedNote';
import { Picture } from '../components/Picture';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useSpeciesIndex, type SpeciesItem } from '../features/library/api';
import { CorrectedNote } from '../components/CorrectedNote';
import { SearchBox } from '../components/SearchBox';
import { ContentHero } from '../components/ContentHero';
import { useTreeCategories } from '../features/content/api';
import { SpeciesPill } from '../components/Pills';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const chip = (on: boolean) =>
  cn('flex min-h-11 shrink-0 items-center rounded-full px-4 font-bold ring-1 transition-colors', on ? 'bg-canopy text-paper ring-canopy' : 'bg-paper text-canopy ring-line shadow-card hover:ring-forest');

/** The nine categories (admin-editable), each with how many trees it has. */
const CategoryChips = ({ value, onChange }: { value: string | null; onChange: (c: string | null) => void }) => {
  const categories = useTreeCategories();
  return (
    <div role="group" aria-label={en.library.filterLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      <button type="button" aria-pressed={value === null} onClick={() => { onChange(null); }} className={chip(value === null)}>
        {en.library.all}
      </button>
      {categories.data?.map(c => (
        <button key={c.slug} type="button" aria-pressed={value === c.slug} onClick={() => { onChange(c.slug); }} className={chip(value === c.slug)}>
          {c.label}
        </button>
      ))}
    </div>
  );
};

const Entry = ({ s }: { s: SpeciesItem }) => (
  <li>
    <Link to={`/library/${s.slug}`} className="group flex min-h-20 items-center gap-3 rounded-lg bg-paper p-3 no-underline shadow-card ring-1 ring-line transition-shadow hover:shadow-lift">
      {s.thumbnail_url ? (
        <Picture src={s.thumbnail_url} alt="" width={64} height={64} sizes="64px" className="size-16 shrink-0 rounded-md object-cover" />
      ) : (
        // No photo yet: the tree's initial, set like a botanical plate label
        <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-md bg-sand font-serif text-3xl text-murram italic">
          {s.common_name.charAt(0)}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-lg font-semibold text-canopy group-hover:underline">{s.common_name}</span>
        <span className="font-serif text-bark-muted italic">{s.scientific_name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-bark-muted">
          {s.categories.slice(0, 2).map(c => <SpeciesPill key={c.slug} category={c} />)}
          {en.library.atNurseries(s.nursery_count)}
        </span>
      </span>
    </Link>
  </li>
);

/** The Digital Tree Library index: the client's introduction, then A–Z with jump links and category filters (FR-18). */
const Library = () => {
  usePageTitle(en.nav.library);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const raw = params.get('category');
  const category = raw && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw) ? raw : null;
  const categories = useTreeCategories();
  const categoryLabel = categories.data?.find(c => c.slug === category)?.label;
  const q = params.get('q') ?? '';
  const index = useSpeciesIndex(category, q.trim());

  const setParam = (key: string, value: string | null, replace = false) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace });
  };

  const groups = useMemo(() => {
    const byLetter = new Map<string, SpeciesItem[]>();
    for (const s of index.data?.items ?? []) {
      const letter = s.common_name.charAt(0).toUpperCase();
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), s]);
    }
    return byLetter;
  }, [index.data]);

  return (
    <div className="flex flex-col gap-5">
      <ContentHero contentKey="library.intro" photo="mabira-forest" />

      <div className="flex flex-col gap-3">
        <SearchBox
          value={q}
          onChange={v => { setParam('q', v || null, true); }}
          label={en.library.searchLabel}
          placeholder={en.library.searchPlaceholder}
          suggest={{ types: ['species'], onPick: s => { if (s.kind === 'species') void navigate(`/library/${s.slug}`); return q; } }}
        />
        <CategoryChips value={category} onChange={c => { setParam('category', c); }} />
      </div>

      <nav aria-label={en.library.jumpTo} className="sticky top-16 z-10 -mx-4 overflow-x-auto bg-mist/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0">
        <ol className="flex gap-1">
          {LETTERS.map(l =>
            groups.has(l) ? (
              <li key={l}>
                <a href={`#letter-${l}`} className="flex size-11 items-center justify-center rounded-sm font-bold no-underline ring-1 ring-line hover:bg-forest-tint md:size-9">{l}</a>
              </li>
            ) : (
              <li key={l} aria-hidden className="flex size-11 items-center justify-center text-bark-muted/40 md:size-9">{l}</li>
            )
          )}
        </ol>
      </nav>

      {index.data && <CachedNote fromCache={index.data.fromCache} fetchedAt={index.data.fetchedAt} />}
      {index.data?.correctedQ && <CorrectedNote typed={q} corrected={index.data.correctedQ} />}
      {index.isPending && <SkeletonList rows={6} label={en.nav.library} />}
      {index.isError && !index.data && (
        <ErrorState
          title={isApiError(index.error) && index.error.isOffline ? en.states.offlineNoCache : en.library.loadFailed}
          offline={isApiError(index.error) && index.error.isOffline}
          onRetry={() => { void index.refetch(); }}
          retryLabel={en.states.retry}
        />
      )}
      {index.data && index.data.items.length === 0 && (
        <EmptyState title={en.library.emptyTitle} action={<button type="button" className="min-h-11 font-bold text-forest underline" onClick={() => { setParams(new URLSearchParams()); }}>{en.library.all}</button>}>
          {en.library.emptyBody}
        </EmptyState>
      )}
      {index.data && index.data.items.length > 0 && (
        <div className="flex flex-col gap-6">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-bark-muted">
            <span aria-live="polite">{en.library.count(index.data.items.length)}</span>
            {category && categoryLabel && <Link to={`/nurseries?categories=${category}`} className="font-bold text-forest">{en.library.nurseriesFor(categoryLabel)}</Link>}
          </p>
          {[...groups.entries()].map(([letter, items]) => (
            <section key={letter} aria-labelledby={`letter-${letter}`} className="flex scroll-mt-32 flex-col gap-2">
              <h2 id={`letter-${letter}`} className="scroll-mt-32 font-serif text-2xl font-semibold">{letter}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map(s => <Entry key={s.id} s={s} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
export default Library;
