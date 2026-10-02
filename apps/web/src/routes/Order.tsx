import { isApiError } from '@nurserylink/api-client';
import { Button, Dialog, ErrorState, SkeletonList, formatCount, formatDateTime, formatDistance, formatPhone, formatUGX, telHref, toast } from '@nurserylink/ui';
import { CircleCheck, CircleX, PackageCheck, Phone, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useConfirmDelivery, useOrder, type Order as OrderDto } from '../features/orders/api';
import { clearDraft } from '../features/orders/draft';
import { OrderTimeline } from '../features/orders/OrderTimeline';
import { autoConfirmAt, statusLabel } from '../features/orders/status';
import { StatusBadge } from '../features/orders/StatusBadge';
import { NotFoundPage } from './NotFound';

const Waiting = ({ o }: { o: OrderDto }) => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => { setSlow(true); }, 60_000);
    return () => { window.clearTimeout(t); };
  }, []);
  return (
    <section aria-live="polite" className="flex flex-col items-center gap-3 rounded-lg bg-paper shadow-card px-5 py-8 text-center ring-1 ring-line">
      <Smartphone aria-hidden className="size-12 animate-pulse text-forest motion-reduce:animate-none" />
      <h2 className="text-xl">{en.order.waitingTitle}</h2>
      <p className="max-w-md">{en.order.waitingBody(formatUGX(o.grand_total), o.payment ? formatPhone(o.payment.msisdn) : '')}</p>
      {slow && <p className="max-w-md text-sm text-bark-muted">{en.order.waitingSlow}</p>}
      <p className="max-w-md text-sm text-bark-muted">{en.order.waitingExpiry}</p>
    </section>
  );
};

const Failed = ({ o }: { o: OrderDto }) => (
  <section role="alert" className="flex flex-col items-center gap-3 rounded-lg bg-paper shadow-card px-5 py-8 text-center ring-1 ring-line">
    <CircleX aria-hidden className="size-12 text-laterite" />
    <h2 className="text-xl">{en.order.failedTitle}</h2>
    <p className="max-w-md">{en.order.failedBody}</p>
    <Button asChild size="lg">
      <Link to={`/nurseries/${o.nursery.id}/order?step=pay`}>{en.order.tryAgain}</Link>
    </Button>
  </section>
);

const Placed = ({ o }: { o: OrderDto }) => (
  <section className="flex flex-col gap-3 rounded-md bg-seedling-tint px-5 py-6 ring-1 ring-seedling/40">
    <p className="flex items-center gap-2 text-xl font-bold text-canopy">
      <CircleCheck aria-hidden className="size-7 text-seedling" />
      {en.order.paidTitle}
    </p>
    <p className="font-bold text-canopy">{statusLabel(o.status, o.delivery_type, o.payment_method)}</p>
    <h2 className="text-base">{en.order.nextHeading}</h2>
    <ol className="flex list-decimal flex-col gap-1 pl-5">
      {(o.delivery_type === 'self_pickup' ? en.order.nextSteps.collect : en.order.nextSteps.deliver).map(t => <li key={t}>{t}</li>)}
    </ol>
    <p className="text-sm text-bark">{en.order.escrowNote}</p>
  </section>
);

const ConfirmDelivery = ({ o }: { o: OrderDto }) => {
  const [open, setOpen] = useState(false);
  const confirm = useConfirmDelivery(o.id);
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-paper shadow-card p-5 ring-1 ring-line">
      <Button size="lg" onClick={() => { setOpen(true); }}>
        <PackageCheck aria-hidden />
        {en.order.confirm}
      </Button>
      {o.dispatched_at && <p className="text-sm text-bark-muted">{en.order.autoConfirm(formatDateTime(autoConfirmAt(o.dispatched_at).toISOString()))}</p>}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={en.order.confirmTitle}
        description={en.order.confirmBody(formatUGX(o.grand_total), o.nursery.name)}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setOpen(false); }}>{en.order.confirmNo}</Button>
            <Button
              busy={confirm.isPending}
              onClick={() => {
                confirm.mutate(undefined, {
                  onSuccess: () => {
                    setOpen(false);
                    toast.success(en.order.confirmed);
                  },
                  onError: err => { toast.error(isApiError(err) ? err.message : en.states.loadFailed); },
                });
              }}
            >
              {en.order.confirmYes}
            </Button>
          </>
        }
      />
    </section>
  );
};

/** One order: payment wait, success, progress, and confirming delivery. */
const Order = () => {
  const { id = '' } = useParams();
  const order = useOrder(id);
  const o = order.data;
  usePageTitle(o ? en.order.orderTitle(o.short_code) : en.order.myOrders);

  // Once paid, the checkout draft for that nursery is done with
  useEffect(() => {
    if (o && o.status !== 'pending_payment' && o.status !== 'cancelled') clearDraft(o.nursery.id);
  }, [o]);

  if (isApiError(order.error) && order.error.status === 404) return <NotFoundPage />;
  if (order.isPending) return <SkeletonList rows={3} />;
  if (!o) return <ErrorState title={en.order.loadFailed} onRetry={() => { void order.refetch(); }} retryLabel={en.states.retry} />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link to="/orders" className="font-bold">{en.order.myOrders}</Link>
        <h1 className="font-mono text-2xl">{en.order.orderTitle(o.short_code)}</h1>
        <p className="text-bark-muted">{en.order.from(o.nursery.name)} · {en.order.placedOn(formatDateTime(o.created_at))}</p>
        <div><StatusBadge status={o.status} delivery={o.delivery_type} method={o.payment_method} /></div>
      </header>

      {o.status === 'pending_payment' && <Waiting o={o} />}
      {o.status === 'cancelled' && <Failed o={o} />}
      {o.status === 'escrow_held' && <Placed o={o} />}
      {o.status === 'dispatched' && <ConfirmDelivery o={o} />}

      <section aria-labelledby="progress" className="rounded-lg bg-paper shadow-card p-5 ring-1 ring-line">
        <h2 id="progress" className="mb-3 text-lg">{en.order.timelineHeading}</h2>
        <OrderTimeline status={o.status} delivery={o.delivery_type} times={o} method={o.payment_method} />
      </section>

      <section aria-labelledby="details" className="flex flex-col gap-3 rounded-lg bg-paper shadow-card p-5 ring-1 ring-line">
        <h2 id="details" className="text-lg">{en.order.items}</h2>
        <dl className="flex flex-col divide-y divide-line">
          {o.items.map(i => (
            <div key={i.inventory_id} className="flex justify-between gap-3 py-2">
              <dt>{formatCount(i.quantity)} × {i.species.common_name}</dt>
              <dd className="font-bold">{formatUGX(i.line_total)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 py-2">
            <dt>{o.delivery_type === 'order_and_deliver' && o.distance_km !== null ? en.checkout.deliveryLine(formatDistance(o.distance_km)) : en.checkout.pickupLine}</dt>
            <dd className="font-bold">{o.delivery_fee > 0 ? formatUGX(o.delivery_fee) : en.checkout.free}</dd>
          </div>
          <div className="flex justify-between gap-3 py-2 text-lg">
            <dt className="font-bold">{en.checkout.total}</dt>
            <dd className="font-bold text-canopy">{formatUGX(o.grand_total)}</dd>
          </div>
        </dl>
        <p>
          <span className="font-bold">{o.delivery_type === 'order_and_deliver' ? en.order.deliveryTo : en.order.collectAt}: </span>
          {o.delivery_type === 'order_and_deliver' ? o.delivery_address : o.nursery.name}
        </p>
        {o.payment && (
          <p className="text-sm text-bark-muted">
            {(o.paid_at ? en.order.paidWith : en.order.requestedFrom)(en.checkout.methods[o.payment_method], formatPhone(o.payment.msisdn))}
          </p>
        )}
        <Button asChild variant="secondary" className="self-start">
          <a href={telHref(o.nursery.contact_phone)}>
            <Phone aria-hidden />
            {en.order.call(o.nursery.name)}
          </a>
        </Button>
      </section>
    </div>
  );
};
export default Order;
