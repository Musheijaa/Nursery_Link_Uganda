import { isApiError } from '@nurserylink/api-client';
import { Badge, Button, EligibilityForm, EmptyState, ErrorState, Skeleton, SkeletonList, StockMeter, formatCount, formatDate, formatPhone, toast } from '@nurserylink/ui';
import { ArrowLeft, Globe, LogIn, Mail, Phone } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { CachedNote } from '../components/CachedNote';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useApply, useGiveaway, useMyApplications, type Application } from '../features/giveaways/api';
import { OfferBadge, OrganizerBadge, closingText } from '../features/giveaways/GiveawayCard';
import { paragraphs } from '../features/content/api';
import { useSession } from '../lib/session';
import { NotFoundPage } from './NotFound';

const LocationMap = lazy(() => import('../components/LocationMap'));

const TONE = { pending: 'info', approved: 'positive', rejected: 'danger', collected: 'positive' } as const;

const Card = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg bg-paper p-5 shadow-card ring-1 ring-line">
    <h2 id={id} className="text-lg">{title}</h2>
    {children}
  </section>
);

const Text = ({ value }: { value: string }) => (
  <div className="flex flex-col gap-2">
    {paragraphs(value).map(lines => <p key={lines.join()}>{lines.map((l, i) => (i === 0 ? l : <span key={l}><br />{l}</span>))}</p>)}
  </div>
);

const ApplicationStatus = ({ a }: { a: Application }) => (
  <Card id="my-application" title={en.giveaways.statusHeading}>
    <Badge tone={TONE[a.status]} className="self-start py-1">{en.giveaways.status[a.status]}</Badge>
    <p>{en.giveaways.statusHelp[a.status]}</p>
    <p className="text-sm text-bark-muted">{en.giveaways.requested(formatCount(a.quantity_requested))} · {formatDate(a.created_at)}</p>
  </Card>
);

/**
 * One giveaway (FR-16, FR-17): the offer, organizer, eligibility, how to apply, deadline, where seedlings
 * are given out, trees and contacts. Each part shows only when the organizer provided it. Applying on
 * this site is offered only where the organizer takes applications here.
 */
const Giveaway = () => {
  const { id = '' } = useParams();
  const location = useLocation();
  const giveaway = useGiveaway(id);
  const { user } = useSession();
  const applications = useMyApplications(user?.role === 'buyer');
  const apply = useApply(id);
  const [serverError, setServerError] = useState<string | null>(null);
  const g = giveaway.data?.data;
  usePageTitle(g?.title ?? en.giveaways.title);

  if (isApiError(giveaway.error) && (giveaway.error.status === 404 || giveaway.error.status === 400)) return <NotFoundPage />;
  if (giveaway.isPending) return <SkeletonList rows={3} />;
  if (!g) {
    const offline = isApiError(giveaway.error) && giveaway.error.isOffline;
    return <ErrorState title={offline ? en.states.offlineNoCache : en.giveaways.loadFailed} offline={offline} onRetry={() => { void giveaway.refetch(); }} retryLabel={en.states.retry} />;
  }

  const mine = applications.data?.find(a => a.campaign.id === g.id);
  const closed = g.status === 'closed';
  const contact = g.contact;
  const hasContact = !!(contact.phone ?? contact.email ?? contact.website);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link to="/giveaways" className="flex min-h-11 items-center gap-2 self-start font-bold">
        <ArrowLeft aria-hidden className="size-5" />
        {en.giveaways.back}
      </Link>
      {giveaway.data && <CachedNote fromCache={giveaway.data.fromCache} fetchedAt={giveaway.data.fetchedAt} />}

      <header className="flex flex-col gap-3 overflow-hidden rounded-lg bg-paper p-5 pt-0 shadow-card ring-1 ring-line">
        <span aria-hidden className={`-mx-5 mb-2 h-2 ${g.offer_type === 'free' ? 'bg-sun' : 'bg-lake'}`} />
        <span className="flex flex-wrap items-center gap-2">
          <OfferBadge g={g} />
          {g.status === 'closing_soon' && <Badge tone="stale">{en.giveaways.closingSoon}</Badge>}
        </span>
        <h1 className="text-2xl md:text-3xl">{g.title}</h1>
        <p className="flex flex-wrap items-center gap-2 text-bark-muted">
          <OrganizerBadge type={g.funder_type} />
          {en.giveaways.organizedBy(g.funder_name)}
        </p>
        <p>{g.purpose}</p>
        <p className="font-bold text-canopy">{closed ? en.giveaways.closed : closingText(g)}</p>
        {g.allocated_stock > 0 && (
          <>
            <StockMeter remaining={g.remaining_stock} total={g.allocated_stock} label={en.giveaways.left(formatCount(g.remaining_stock), g.remaining_pct)} />
            <p className="text-sm font-bold">{en.giveaways.left(formatCount(g.remaining_stock), g.remaining_pct)}</p>
          </>
        )}
      </header>

      {g.eligibility_requirements && <Card id="eligibility" title={en.giveaways.whoCanApply}><Text value={g.eligibility_requirements} /></Card>}
      {g.application_procedure && <Card id="procedure" title={en.giveaways.howToApply}><Text value={g.application_procedure} /></Card>}
      {g.application_deadline && (
        <Card id="deadline" title={en.giveaways.deadline}>
          <p className="font-bold">{formatDate(g.application_deadline)}</p>
        </Card>
      )}

      {g.species.length > 0 && (
        <Card id="trees" title={en.giveaways.trees}>
          <ul className="flex flex-col divide-y divide-line">
            {g.species.map(s => (
              <li key={s.slug} className="flex items-center justify-between gap-3">
                <Link to={`/library/${s.slug}`} className="flex min-h-11 items-center underline">{s.common_name}</Link>
                <span className="font-bold">{formatCount(s.quantity)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {g.distribution_locations && <Card id="distribution" title={en.giveaways.distribution}><Text value={g.distribution_locations} /></Card>}

      {g.pickup_nursery && g.sub_county && (
        <Card id="pickup" title={en.giveaways.pickupHeading}>
          <Link to={`/nurseries?nursery=${g.pickup_nursery.id}`} className="flex min-h-11 items-center self-start underline">
            {en.giveaways.pickupAt(g.pickup_nursery.name, g.sub_county.name)}
          </Link>
          <Suspense fallback={<Skeleton className="h-72 rounded-md" />}>
            <LocationMap nursery={g.pickup_nursery.location} label={en.giveaways.pickupHeading} />
          </Suspense>
        </Card>
      )}

      {hasContact && (
        <Card id="contact" title={en.giveaways.contactHeading}>
          <ul className="flex flex-wrap gap-3">
            {contact.phone && (
              <li>
                <Button asChild variant="secondary">
                  <a href={`tel:${contact.phone}`}><Phone aria-hidden />{en.giveaways.call} {formatPhone(contact.phone)}</a>
                </Button>
              </li>
            )}
            {contact.email && (
              <li>
                <Button asChild variant="secondary">
                  <a href={`mailto:${contact.email}`}><Mail aria-hidden />{contact.email}</a>
                </Button>
              </li>
            )}
            {contact.website && (
              <li>
                <Button asChild variant="secondary">
                  <a href={contact.website} target="_blank" rel="noopener noreferrer">
                    <Globe aria-hidden />{en.giveaways.website}<span className="sr-only"> {en.giveaways.opensNewTab}</span>
                  </a>
                </Button>
              </li>
            )}
          </ul>
        </Card>
      )}

      {mine ? (
        <ApplicationStatus a={mine} />
      ) : closed ? (
        <EmptyState title={en.giveaways.closed} action={<Button asChild variant="secondary"><Link to="/giveaways">{en.giveaways.seeOpen}</Link></Button>}>
          {en.giveaways.closedBody}
        </EmptyState>
      ) : !g.accepts_platform_applications ? (
        <p className="rounded-lg bg-sky-tint p-4 text-bark">{en.giveaways.applyElsewhere}</p>
      ) : g.is_open ? (
        <Card id="apply" title={en.giveaways.eligibilityHeading}>
          {user ? (
            <>
              <p className="text-bark-muted">{en.giveaways.eligibilityIntro}</p>
              <EligibilityForm
                rules={g.eligibility_rules}
                maxQuantity={g.remaining_stock}
                labels={en.giveaways}
                busy={apply.isPending}
                serverError={serverError}
                onSubmit={application => {
                  setServerError(null);
                  apply.mutate(application, {
                    onSuccess: () => { toast.success(en.giveaways.applied, en.giveaways.statusHelp.pending); },
                    onError: err => { setServerError(isApiError(err) ? err.message : en.states.loadFailed); },
                  });
                }}
              />
            </>
          ) : (
            <>
              {/* The checklist is visible before signing in, so people know if they qualify */}
              {g.eligibility_rules.length > 0 && (
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {g.eligibility_rules.map(r => <li key={r.key}>{r.label}{r.required ? '' : ` (${en.giveaways.optional})`}</li>)}
                </ul>
              )}
              <p className="text-bark-muted">{en.giveaways.signInHint}</p>
              <Button asChild size="lg" className="self-start">
                <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>
                  <LogIn aria-hidden />
                  {en.giveaways.signInToApply}
                </Link>
              </Button>
            </>
          )}
        </Card>
      ) : null}
    </article>
  );
};
export default Giveaway;
