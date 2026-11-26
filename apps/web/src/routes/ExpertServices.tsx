import { isApiError } from '@nurserylink/api-client';
import { Button, ErrorState, SkeletonList, cn } from '@nurserylink/ui';
import { ChartColumn, ChevronDown, ClipboardList, Leaf, Map as MapIcon, Sprout, Trees, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { ContentHero } from '../components/ContentHero';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useExpertServices, type ServiceCategory } from '../features/content/api';
import { ServiceRequestForm } from '../features/content/EnquiryForms';

/** Icons admins can choose for a service area (service_categories.icon) */
const ICONS: Record<string, LucideIcon> = { trees: Trees, sprout: Sprout, map: MapIcon, leaf: Leaf, chart: ChartColumn, clipboard: ClipboardList };

const t = en.expertServices;

const CategoryCard = ({ c, onRequest }: { c: ServiceCategory; onRequest: () => void }) => {
  const Icon = ICONS[c.icon] ?? Leaf;
  return (
    <li id={c.slug} className="flex scroll-mt-24 flex-col gap-3 rounded-lg bg-paper p-5 shadow-card ring-1 ring-line">
      <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-seedling-tint text-canopy">
        <Icon className="size-6" />
      </span>
      <h2 className="text-h4">{c.title}</h2>
      <p className="text-bark-muted">{c.intro}</p>
      {/* The list folds away so the cards stay short; it opens by default when linked to directly */}
      <details className="group" open={typeof window !== 'undefined' && window.location.hash === `#${c.slug}`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold text-forest">
          <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          {t.showServices(c.services.length)}
        </summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
          {c.services.map(s => <li key={s.id}>{s.title}</li>)}
        </ul>
      </details>
      <Button className="mt-auto self-start" onClick={onRequest}>{t.request}</Button>
    </li>
  );
};

/** Expert Services: the six areas of expertise, and a request form for any of them (no account needed). */
const ExpertServices = () => {
  usePageTitle(en.nav.expertServices);
  const services = useExpertServices();
  const { hash } = useLocation();
  const [chosen, setChosen] = useState<string | null>(null);
  const formRef = useRef<HTMLElement>(null);
  const list = services.data ?? [];
  const category = list.find(c => c.id === chosen) ?? null;

  // A link to /expert-services#slug (e.g. from search) scrolls to that area once the list has loaded
  useEffect(() => {
    if (hash && list.length) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, list.length]);

  const request = (id: string) => {
    setChosen(id);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current?.focus();
    });
  };

  const offline = isApiError(services.error) && services.error.isOffline;

  return (
    <div className="flex flex-col gap-6">
      <ContentHero contentKey="expert_services.intro" photo="agroforestry-masaka" />

      {services.isPending && <SkeletonList rows={3} label={en.nav.expertServices} />}
      {services.isError && !services.data && (
        <ErrorState title={offline ? en.states.offlineNoCache : t.loadFailed} offline={offline} onRetry={() => { void services.refetch(); }} retryLabel={en.states.retry} />
      )}
      {list.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map(c => <CategoryCard key={c.id} c={c} onRequest={() => { request(c.id); }} />)}
        </ul>
      )}

      {list.length > 0 && (
        <section
          ref={formRef}
          id="request"
          tabIndex={-1}
          aria-labelledby="request-heading"
          className="flex scroll-mt-20 flex-col gap-4 rounded-lg bg-paper p-5 shadow-card ring-1 ring-line outline-none md:p-6"
        >
          <h2 id="request-heading" className="text-h3">{t.formHeading}</h2>
          <p className="text-bark-muted">{t.formIntro}</p>
          <div role="group" aria-label={t.chooseArea} className="flex flex-wrap gap-2">
            {list.map(c => (
              <button
                key={c.id}
                type="button"
                aria-pressed={chosen === c.id}
                onClick={() => { setChosen(c.id); }}
                className={cn('min-h-11 rounded-full px-4 text-left font-bold ring-1', chosen === c.id ? 'bg-canopy text-paper ring-canopy' : 'bg-paper text-canopy ring-line hover:ring-canopy')}
              >
                {c.title}
              </button>
            ))}
          </div>
          {category ? <ServiceRequestForm key={category.id} category={category} /> : <p className="font-bold text-bark-muted">{t.chooseFirst}</p>}
        </section>
      )}
    </div>
  );
};
export default ExpertServices;
