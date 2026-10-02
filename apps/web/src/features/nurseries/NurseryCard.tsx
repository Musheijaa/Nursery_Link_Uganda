import { isApiError, type Schemas } from '@nurserylink/api-client';
import {
  Badge, Button, Drawer, ErrorState, SkeletonList, formatCount, formatDistance, formatPhone, formatRelative, formatUGX, telHref,
} from '@nurserylink/ui';
import { ArrowLeft, BadgeCheck, Clock, Gift, MapPin, Navigation, Phone, ShoppingCart } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { en } from '../../copy/en';
import type { LatLng } from '../../lib/geo';
import { useNurseryProfile, useRoute } from './api';
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

const Details = ({ n, onSpecies }: { n: Profile; onSpecies: (slug: string) => void }) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-bark-muted">{en.nurseryCard.types[n.type]}</span>
      {n.certification_status === 'certified' ? (
        <Badge tone="positive"><BadgeCheck aria-hidden />{en.nurseryCard.certification.certified}</Badge>
      ) : (
        <Badge tone="neutral">{en.nurseryCard.certification[n.certification_status]}</Badge>
      )}
    </div>

    <div className="flex flex-col gap-2">
      <Row icon={<MapPin aria-hidden />}>
        {[n.distance_km !== undefined ? en.nurseryCard.distanceFromYou(formatDistance(n.distance_km, n.distance_mode ?? 'road')) : null, `${n.sub_county.name}, ${n.district.name}`].filter(Boolean).join(' · ')}
      </Row>
      <Row icon={<Phone aria-hidden />}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{n.operator_name} · {formatPhone(n.contact_phone)}</span>
          <Button asChild variant="secondary" size="sm" className="min-h-11">
            <a href={telHref(n.contact_phone)} aria-label={`${en.nurseryCard.call} ${n.name}`}>{en.nurseryCard.call}</a>
          </Button>
        </span>
      </Row>
      <p className="text-sm text-bark-muted">{en.nurseryCard.capacity(formatCount(n.annual_capacity))}</p>
      {n.seed_source && <p className="text-sm"><span className="font-bold">{en.nurseryCard.seedSource}:</span> {n.seed_source}</p>}
    </div>

    {n.stock_categories.length > 0 && (
      <ul aria-label={en.nurseryCard.stocks} className="flex flex-wrap gap-2">
        {n.stock_categories.map(c => (
          <li key={c}><SpeciesPill category={c} className="px-3 py-1 text-sm" /></li>
        ))}
      </ul>
    )}

    <StockFreshness at={n.stock_updated_at} />

    {n.active_campaigns.length > 0 && (
      <div className="flex flex-col gap-2 rounded-md bg-sun-tint p-3 ring-1 ring-canopy/30">
        <p className="flex items-center gap-2 font-bold text-canopy"><Gift aria-hidden className="size-5" />{en.nurseryCard.freeCampaigns}</p>
        {n.active_campaigns.map(c => (
          <Link key={c.id} to={`/free-seedlings/${c.id}`} className="font-bold">
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

const Directions = ({ id, position, name, onBack }: { id: string; position: LatLng | null; name: string; onBack: () => void }) => {
  const route = useRoute(id, position, true);
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 self-start font-bold text-forest">
        <ArrowLeft aria-hidden className="size-5" />
        {en.directions.back}
      </button>
      <h3 className="text-lg">{en.directions.title(name)}</h3>
      {!position && <p>{en.directions.needLocation}</p>}
      {route.isPending && position && <SkeletonList rows={4} />}
      {route.isError && <ErrorState title={en.directions.failed} onRetry={() => { void route.refetch(); }} retryLabel={en.states.retry} />}
      {route.data && (
        <>
          <p className="font-bold text-canopy">{en.directions.summary(formatDistance(route.data.distance_km), route.data.duration_min)}</p>
          <ol aria-label={en.directions.steps} className="flex flex-col divide-y divide-line">
            {route.data.steps.map((step, i) => (
              <li key={i} className="flex gap-3 py-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-forest-tint text-sm font-bold text-forest">{i + 1}</span>
                <span className="flex flex-col">
                  <span>{step.instruction}</span>
                  {step.distance_m > 0 && <span className="text-sm text-bark-muted">{step.distance_m >= 1000 ? `${(step.distance_m / 1000).toFixed(1)} km` : `${String(step.distance_m)} m`}</span>}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
};

/** The nursery card: a side drawer on desktop, a full-height sheet on phones (FR-10). */
export const NurseryCard = ({ id, position, directions, onClose, onDirections, onSpecies, modal }: {
  id: string | null;
  position: LatLng | null;
  directions: boolean;
  onClose: () => void;
  onDirections: (on: boolean) => void;
  onSpecies: (slug: string) => void;
  modal: boolean;
}) => {
  const profile = useNurseryProfile(id, position);
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
        n && !directions ? (
          // Side by side where they fit; stacked on small phones so labels stay on one line
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <Button variant="secondary" onClick={() => { onDirections(true); }}>
              <Navigation aria-hidden />
              {en.nurseryCard.directions}
            </Button>
            <Button asChild>
              <Link to={`/nurseries/${n.id}/order`}>
                <ShoppingCart aria-hidden />
                {en.nurseryCard.order}
              </Link>
            </Button>
          </div>
        ) : undefined
      }
    >
      {profile.isPending && <SkeletonList rows={5} />}
      {profile.isError && !n && (
        <ErrorState title={offline ? en.states.offlineNoCache : en.nurseryCard.loadFailed} offline={offline} onRetry={() => { void profile.refetch(); }} retryLabel={en.states.retry} />
      )}
      {n && (directions ? <Directions id={n.id} position={position} name={n.name} onBack={() => { onDirections(false); }} /> : <Details n={n} onSpecies={onSpecies} />)}
    </Drawer>
  );
};
