import type { FunderType } from '@nurserylink/shared';
import { Badge, StockMeter, cn, formatDate, formatUGX } from '@nurserylink/ui';
import { Link } from 'react-router';
import { en } from '../../copy/en';
import type { Giveaway } from './api';

/** Free (gift-yellow) or Subsidised (with its price): clearly different at a glance. */
export const OfferBadge = ({ g, className }: { g: Pick<Giveaway, 'offer_type' | 'subsidised_price'>; className?: string }) =>
  g.offer_type === 'free' ? (
    <span className={cn('inline-flex items-center rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-bark ring-1 ring-canopy', className)}>{en.giveaways.free}</span>
  ) : (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-lake px-2.5 py-0.5 text-xs font-bold text-paper', className)}>
      {en.giveaways.subsidised}
      {g.subsidised_price !== null && <span className="font-normal">· {en.giveaways.subsidisedPrice(formatUGX(g.subsidised_price))}</span>}
    </span>
  );

/** Who runs it: government, NGO, foundation, company, community or other. */
export const OrganizerBadge = ({ type }: { type: FunderType }) => <Badge tone="neutral">{en.giveaways.organizer[type]}</Badge>;

/** When applications close, or when they closed */
export const closingText = (g: Pick<Giveaway, 'status' | 'closes_at'>) =>
  g.status === 'closed' ? en.giveaways.closedOn(formatDate(g.closes_at)) : en.giveaways.closes(formatDate(g.closes_at));

/** A giveaway teaser: offer, organizer, closing date, where, and the stock meter when it has one. */
export const GiveawayCard = ({ g, detailed = false }: { g: Giveaway; detailed?: boolean }) => (
  <Link
    to={`/giveaways/${g.id}`}
    className="group flex h-full flex-col overflow-hidden rounded-lg bg-paper no-underline shadow-card ring-1 ring-line transition-shadow hover:shadow-lift"
  >
    <span aria-hidden className={cn('h-1.5', g.offer_type === 'free' ? 'bg-sun' : 'bg-lake')} />
    <span className="flex flex-1 flex-col gap-3 p-4">
      <span className="flex flex-wrap items-center gap-2">
        <OfferBadge g={g} />
        {g.status === 'closing_soon' && <Badge tone="stale">{en.giveaways.closingSoon}</Badge>}
      </span>
      <span className="font-display text-xl leading-snug font-semibold text-canopy group-hover:underline">{g.title}</span>
      {detailed && (
        <span className="flex flex-wrap items-center gap-2 text-sm text-bark-muted">
          <OrganizerBadge type={g.funder_type} />
          {en.giveaways.organizedBy(g.funder_name)}
        </span>
      )}
      <span className="text-sm text-bark">
        {detailed && `${g.purpose} · `}
        {closingText(g)}
      </span>
      {g.pickup_nursery && g.sub_county ? (
        <span className="text-sm text-bark-muted">{en.giveaways.pickupAt(g.pickup_nursery.name, g.sub_county.name)}</span>
      ) : g.distribution_locations ? (
        <span className="line-clamp-2 text-sm text-bark-muted">{g.distribution_locations}</span>
      ) : null}
      {g.allocated_stock > 0 && (
        <span className="mt-auto flex flex-col gap-1.5">
          <StockMeter remaining={g.remaining_stock} total={g.allocated_stock} label={`${g.title}: ${String(g.remaining_pct)}%`} />
          <span className="text-sm font-bold text-bark">{en.giveaways.left(String(g.remaining_stock), g.remaining_pct)}</span>
        </span>
      )}
    </span>
  </Link>
);
