import '@nurserylink/ui/library-fonts.css';
import { isApiError } from '@nurserylink/api-client';
import { Button, ErrorState, SkeletonList, formatUGX } from '@nurserylink/ui';
import { ArrowLeft, LocateFixed } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { CachedNote } from '../components/CachedNote';
import { Picture } from '../components/Picture';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useSpeciesProfile } from '../features/library/api';
import { GrowthChart } from '../features/library/GrowthChart';
import { ProfileSections } from '../features/library/ProfileSections';
import { NotFoundPage } from './NotFound';
import { SpeciesPill } from '../components/Pills';

/** A Tree Library profile (FR-19) in exactly five sections; anything not written yet is left out. */
const Species = () => {
  const { slug = '' } = useParams();
  const profile = useSpeciesProfile(slug);
  const s = profile.data?.data;
  usePageTitle(s?.common_name ?? en.nav.library);

  if (isApiError(profile.error) && profile.error.status === 404) return <NotFoundPage />;
  if (profile.isPending) return <SkeletonList rows={4} label={en.nav.library} />;
  if (!s) {
    const offline = isApiError(profile.error) && profile.error.isOffline;
    return <ErrorState title={offline ? en.states.offlineNoCache : en.species.loadFailed} offline={offline} onRetry={() => { void profile.refetch(); }} retryLabel={en.states.retry} />;
  }

  const [lead, ...gallery] = s.media;
  const from = s.min_price !== null ? formatUGX(s.min_price) : null;
  const to = s.max_price !== null ? formatUGX(s.max_price) : null;

  const [firstCategory] = s.categories;

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-5">
      <Link to={firstCategory ? `/library?category=${firstCategory.slug}` : '/library'} className="flex min-h-11 items-center gap-2 self-start font-bold">
        <ArrowLeft aria-hidden className="size-5" />
        {en.species.back}{firstCategory ? ` · ${firstCategory.label}` : ''}
      </Link>
      {profile.data && <CachedNote fromCache={profile.data.fromCache} fetchedAt={profile.data.fetchedAt} />}

      {/* 1. Tree Identity: always open. The sheet is white paper with a thin frame, like a herbarium mount. */}
      <section aria-labelledby="section-identity" className="flex flex-col gap-5 rounded-lg bg-paper p-5 shadow-card ring-1 ring-canopy/40 md:p-8">
        <h2 id="section-identity" className="sr-only">{en.species.sections.identity}</h2>
        <div className="grid gap-5 md:grid-cols-[280px_1fr]">
          {lead && (
            <figure className="flex flex-col gap-2">
              <Picture src={lead.url} alt={`${s.common_name} (${s.scientific_name})`} width={560} height={420} sizes="(min-width: 768px) 280px, 100vw" priority className="aspect-[4/3] w-full rounded-sm object-cover ring-1 ring-line" />
              {lead.caption && <figcaption className="text-xs text-bark-muted">{lead.caption}</figcaption>}
            </figure>
          )}
          <div className="flex flex-col gap-3">
            <p className="font-label text-sm font-bold text-murram">{en.species.sections.identity}</p>
            <div>
              <h1 className="text-3xl">{s.common_name}</h1>
              <p className="font-serif text-2xl text-bark-muted italic" lang="la">{s.scientific_name}</p>
            </div>
            {s.botanical_family && (
              <p><span className="font-bold">{en.species.fields.botanical_family}: </span>{s.botanical_family}</p>
            )}
            {s.local_names.length > 0 && (
              <p>
                <span className="font-bold">{en.species.alsoCalled}: </span>
                {s.local_names.map(l => `${l.name} (${l.language})`).join(' · ')}
              </p>
            )}
            {s.categories.length > 0 && (
              <ul aria-label={en.species.categoriesLabel} className="flex flex-wrap items-center gap-2">
                {s.categories.map(c => <li key={c.slug}><SpeciesPill category={c} className="px-3 py-1 text-sm" /></li>)}
              </ul>
            )}
            <p className="text-bark-muted">{en.species.availability(s.nursery_count, from, to)}</p>
            {s.reference_price && (
              <p className="flex flex-col gap-0.5 rounded-sm bg-sky-tint px-3 py-2 text-sm text-bark">
                <span>
                  <span className="font-bold text-lake">{en.species.priceGuide}: </span>
                  {en.species.nfaPrice(formatUGX(s.reference_price.ugx), s.reference_price.pot_inches)}
                </span>
                <Link to="/news/nfa-seedling-price-guide" className="flex min-h-11 items-center self-start">{en.species.priceGuideMore}</Link>
              </p>
            )}
            {/* FR-20: research turns straight into a supplier search near the user */}
            <Button asChild size="lg" className="self-start">
              <Link to={`/nurseries?species=${encodeURIComponent(s.slug)}`}>
                <LocateFixed aria-hidden />
                {en.species.findNearMe}
              </Link>
            </Button>
          </div>
        </div>
        {gallery.length > 0 && (
          <ul aria-label={en.species.photos} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map(m => (
              <li key={m.url}>
                <figure className="flex flex-col gap-1">
                  <Picture src={m.url} alt={m.caption ?? s.common_name} width={320} height={240} sizes="(min-width: 640px) 33vw, 50vw" className="aspect-[4/3] w-full rounded-sm object-cover" />
                  {m.caption && <figcaption className="text-xs text-bark-muted">{m.caption}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2–5: shown only when something is written; the growth chart belongs to About the Tree */}
      <ProfileSections
        s={s}
        extra={{
          about: s.height_timeline.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-bold text-canopy">{en.species.growthHeading}</h3>
              <GrowthChart timeline={s.height_timeline} />
            </div>
          ),
        }}
      />
    </article>
  );
};
export default Species;
