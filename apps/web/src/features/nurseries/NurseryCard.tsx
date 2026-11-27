import { isApiError, type Schemas } from '@nurserylink/api-client';
import {
  Badge, Button, Drawer, ErrorState, SkeletonList, formatCount, formatDate, formatDistance, formatPhone, formatRelative, formatUGX, telHref,
} from '@nurserylink/ui';
import { BadgeCheck, Clock, Gift, MapPin, MessageCircle, Navigation, Phone, ShoppingCart } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { en } from '../../copy/en';
import type { LatLng } from '../../lib/geo';
import { useNurseryProfile } from './api';
import { directionsHref } from '../../lib/googleMaps';
import { useFeatures } from '../orders/api';
import { isStale } from './stock';
import { SpeciesPill } from '../../components/Pills';

type Profile = Schemas['NurseryProfile'];

const Row = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <p className="flex items-start gap-2">
    <span className="mt-0.5 shrink-0 text-forest [&_svg]:size-5">{icon}</span>
    <span>{children}</span>
  </p>
);

const StockFreshness = ({ at }: { at: string | null }) => {
  if (!at) return <Badge tone="neutral">{en.nurseryCard.stockUnknown}</Badge>;
  const when = formatRelative(at);
  return isStale(at) ? (
    <Badge tone="stale">
      <Clock aria-hidden />
      {en.nurseryCard.stockStale(when)}
    </Badge>
  ) : (
    <p className="flex items-center gap-1 text-sm text-bark-muted">
      <Clock aria-hidden className="size-4" />
      {en.nurseryCard.stockUpdated(when)}
    </p>
  );
};

/** Invented sample nurseries (demo data) say so up front, so nobody travels to one. */
export const SampleNote = () => (
  <p role="note" className="flex flex-col gap-0.5 rounded-md bg-amber-tint px-3 py-2 text-sm text-bark ring-1 ring-amber/30">
    <span className="font-bold text-amber">{en.nurseryCard.sampleTitle}</span>
    {en.nurseryCard.sampleBody}
  </p>
);

/** wa.me wants the number in international form without the plus: +256772123456 → 256772123456 */
export const whatsappHref = (e164: string) => `https://wa.me/${e164.replace(/^\+/, '')}`;

/**
 * Calling the operator is how people order (How It Works, step 3), so the number is the card's main
 * action: a large tap-to-call button, and WhatsApp beside it.
 */
const ContactOperator = ({ n }: { n: Profile }) =>
  n.contact_phone ? (
    <div className="flex flex-col gap-2 rounded-md bg-seedling-tint p-3">
      <p className="text-sm text-bark">{en.nurseryCard.callHint(n.operator_name)}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg" className="grow">
          <a href={telHref(n.contact_phone)} aria-label={en.nurseryCard.callLabel(n.operator_name, formatPhone(n.contact_phone))}>
            <Phone aria-hidden />
            {formatPhone(n.contact_phone)}
          </a>
        </Button>
        <Button asChild size="lg" variant="secondary" className="grow">
          <a href={whatsappHref(n.contact_phone)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            {en.nurseryCard.whatsapp}
            <span className="sr-only"> {en.nurseryCard.newTab}</span>
          </a>
        </Button>
      </div>
    </div>
  ) : (
    <p className="text-sm text-bark-muted">{n.operator_name} · {en.nurseryCard.noPhone}</p>
  );

/** "Certified" only when an admin recorded the certification; its details are the badge's tooltip and caption. */
const Certification = ({ n }: { n: Profile }) => {
  if (!n.certification) return <Badge tone="neutral">{en.nurseryCard.uncertified}</Badge>;
  const detail = en.nurseryCard.certifiedBy(n.certification.body, n.certification.ref, formatDate(n.certification.verified_at));
  return (
    <span className="flex flex-col gap-0.5">
      <Badge tone="positive" className="self-start" title={detail}><BadgeCheck aria-hidden />{en.nurseryCard.certified}</Badge>
      <span className="text-xs text-bark-muted">{detail}</span>
    </span>
  );
};

const Details = ({ n, onSpecies }: { n: Profile; onSpecies: (slug: string) => void }) => (
  <div className="flex flex-col gap-4">
    {n.is_demo && <SampleNote />}
    <div className="flex flex-wrap items-start gap-2">
      <span className="text-sm text-bark-muted">{en.nurseryCard.types[n.type]}</span>
      <Certification n={n} />
    </div>

    <ContactOperator n={n} />

    <div className="flex flex-col gap-2">
      <Row icon={<MapPin aria-hidden />}>
        {[n.distance_km !== undefined ? en.nurseryCard.distanceFromYou(formatDistance(n.distance_km, n.distance_mode ?? 'road')) : null, `${n.sub_county.name}, ${n.district.name}`].filter(Boolean).join(' · ')}
      </Row>
      <p className="text-sm text-bark-muted">{en.nurseryCard.capacity(formatCount(n.annual_capacity))}</p>
      {n.seed_source && <p className="text-sm"><span className="font-bold">{en.nurseryCard.seedSource}:</span> {n.seed_source}</p>}
    </div>

    {n.stock_categories.length > 0 && (
      <ul aria-label={en.nurseryCard.stocks} className="flex flex-wrap gap-2">
        {n.stock_categories.map(c => (
          <li key={c.slug}><SpeciesPill category={c} className="px-3 py-1 text-sm" /></li>
        ))}
      </ul>
    )}

    <StockFreshness at={n.stock_updated_at} />

    {n.active_campaigns.length > 0 && (
      <div className="flex flex-col gap-2 rounded-md bg-sun-tint p-3 ring-1 ring-canopy/30">
        <p className="flex items-center gap-2 font-bold text-canopy"><Gift aria-hidden className="size-5" />{en.nurseryCard.giveaways}</p>
        {n.active_campaigns.map(c => (
          <Link key={c.id} to={`/giveaways/${c.id}`} className="font-bold">
            {c.title} · {en.nurseryCard.seeCampaign}
          </Link>
        ))}
      </div>
    )}

    <section aria-labelledby="stock-heading" className="flex flex-col gap-2">
      <h3 id="stock-heading" className="text-lg">{en.nurseryCard.inStock}</h3>
      <ul className="flex flex-col divide-y divide-line">
        {n.inventory.map(item => (
          <li key={item.inventory_id} className="flex items-center justify-between gap-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => { onSpecies(item.species.slug); }}
                className="min-h-11 text-left font-bold text-forest underline underline-offset-2"
                aria-label={`${item.species.common_name}: ${en.nurseryCard.aboutTree(item.species.common_name)}`}
              >
                {item.species.common_name}
              </button>
            </span>
            <span className="shrink-0 text-right text-sm">
              <span className="block font-bold text-bark">{formatUGX(item.unit_price)} <span className="font-normal text-bark-muted">{en.nurseryCard.each}</span></span>
              <span className="block text-bark-muted">{en.nurseryCard.available(formatCount(item.quantity_available))}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  </div>
);

/** The nursery card: a side drawer on desktop, a full-height sheet on phones (FR-10). */
export const NurseryCard = ({ id, position, onClose, onSpecies, modal }: {
  id: string | null;
  position: LatLng | null;
  onClose: () => void;
  onSpecies: (slug: string) => void;
  modal: boolean;
}) => {
  const profile = useNurseryProfile(id, position);
  const features = useFeatures();
  // Online ordering is optional (FEATURE_ORDERS); calling the operator is always the main action
  const ordering = features.data?.orders === true;
  const n = profile.data?.data;
  const offline = isApiError(profile.error) && profile.error.isOffline;
  return (
    <Drawer
      open={id !== null}
      onOpenChange={open => { if (!open) onClose(); }}
      title={n?.name ?? '…'}
      closeLabel={en.nurseryCard.close}
      modal={modal}
      footer={
        n && !(n.is_demo && !ordering) ? (
          // Side by side where they fit; stacked on small phones so labels stay on one line
          <div className={ordering && !n.is_demo ? 'grid grid-cols-1 gap-2 min-[420px]:grid-cols-2' : 'grid grid-cols-1'}>
            {/* Turn-by-turn directions are Google Maps' job: this opens its app on phones (brief §2) */}
            {!n.is_demo && (
              <Button asChild variant="secondary">
                <a href={directionsHref(n.location)} target="_blank" rel="noopener noreferrer">
                  <Navigation aria-hidden />
                  {en.maps.getDirections}
                  <span className="sr-only"> {en.maps.opensGoogleMaps}</span>
                </a>
              </Button>
            )}
            {ordering && (
              <Button asChild>
                <Link to={`/nurseries/${n.id}/order`}>
                  <ShoppingCart aria-hidden />
                  {en.nurseryCard.order}
                </Link>
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {profile.isPending && <SkeletonList rows={5} />}
      {profile.isError && !n && (
        <ErrorState title={offline ? en.states.offlineNoCache : en.nurseryCard.loadFailed} offline={offline} onRetry={() => { void profile.refetch(); }} retryLabel={en.states.retry} />
      )}
      {n && <Details n={n} onSpecies={onSpecies} />}
    </Drawer>
  );
};
