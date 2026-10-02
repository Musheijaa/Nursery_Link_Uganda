import { Button, EmptyState, Skeleton, SkeletonList, formatCount, formatPhone, telHref } from '@nurserylink/ui';
import { MapPin, Navigation, Phone } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useOrderMap } from '../features/orders/api';

const LocationMap = lazy(() => import('../components/LocationMap'));

/**
 * The page behind the "Map:" link in the nursery's order SMS: where to deliver, what to prepare,
 * who to call. No account needed; the link's key opens it.
 */
const OrderMap = () => {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const map = useOrderMap(code, params.get('k') ?? '');
  const o = map.data;
  usePageTitle(en.orderMap.title(code.toUpperCase()));

  if (map.isPending && map.fetchStatus !== 'idle') return <SkeletonList rows={3} />;
  if (!o) return <EmptyState title={en.orderMap.notFound} />;

  const drop = o.delivery_point;
  const directions = drop ? `https://www.google.com/maps/dir/?api=1&destination=${String(drop.lat)},${String(drop.lng)}` : null;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-mono text-2xl">{en.orderMap.title(o.short_code)}</h1>
        <p className="text-bark-muted">{en.orderMap.intro}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-72 rounded-md md:h-96" />}>
        <LocationMap nursery={o.nursery.location} drop={drop} label={en.orderMap.deliverTo} />
      </Suspense>
      <section className="flex flex-col gap-3 rounded-lg bg-paper shadow-card p-5 ring-1 ring-line">
        {o.delivery_type === 'order_and_deliver' ? (
          <p className="flex gap-2">
            <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" />
            <span><span className="font-bold">{en.orderMap.deliverTo}: </span>{o.delivery_address}</span>
          </p>
        ) : (
          <p>{en.orderMap.collect}</p>
        )}
        <p><span className="font-bold">{en.orderMap.buyer}: </span>{o.buyer.full_name} · {formatPhone(o.buyer.phone)}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={telHref(o.buyer.phone)}><Phone aria-hidden />{en.orderMap.call}</a>
          </Button>
          {directions && (
            <Button asChild variant="secondary">
              <a href={directions} rel="noopener noreferrer"><Navigation aria-hidden />{en.orderMap.directions}</a>
            </Button>
          )}
        </div>
      </section>
      <section aria-labelledby="prepare" className="flex flex-col gap-2 rounded-lg bg-paper shadow-card p-5 ring-1 ring-line">
        <h2 id="prepare" className="text-lg">{en.orderMap.items}</h2>
        <ul className="flex flex-col divide-y divide-line">
          {o.items.map(i => <li key={i.common_name} className="flex justify-between py-2"><span>{i.common_name}</span><span className="font-bold">{formatCount(i.quantity)}</span></li>)}
        </ul>
        <p className="rounded-sm bg-forest-tint px-3 py-2 text-forest">{en.orderMap.replyHint(o.short_code)}</p>
      </section>
    </div>
  );
};
export default OrderMap;
