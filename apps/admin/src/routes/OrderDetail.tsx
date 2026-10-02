import { adminOrderActions, type AdminOrderAction } from '@nurserylink/shared';
import { Button, ErrorState, SkeletonList, formatDateTime, formatDistance, formatPhone, formatUGX, telHref, toast } from '@nurserylink/ui';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { ReasonDialog } from '../components/ReasonDialog';
import { en } from '../copy/en';
import { useAdminOrder, useOrderAction, useOrderHistory, type AuditEntry } from '../features/orders/api';
import { StatusBadge } from '../features/orders/StatusBadge';
import { toastError } from '../lib/errors';

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="flex flex-col gap-1 rounded-lg bg-paper shadow-card p-4 text-sm ring-1 ring-line">
    <h2 className="mb-1 text-base">{title}</h2>
    {children}
  </section>
);

const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** One history line in plain words: "Paid, held → Dispatched", with the reason and who did it. */
const HistoryItem = ({ entry }: { entry: AuditEntry }) => {
  const before = obj(entry.before);
  const after = obj(entry.after);
  const from = str(before.status);
  const to = str(after.status);
  const label = (s: string | undefined) => (s && s in en.orders.statuses ? en.orders.statuses[s as keyof typeof en.orders.statuses] : s);
  const reason = str(after.reason) ?? str(after.note);
  return (
    <li className="relative border-l-2 border-line pb-4 pl-4 last:pb-0">
      <span aria-hidden className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-forest" />
      <p className="font-bold">{to ? `${from ? `${String(label(from))} → ` : ''}${String(label(to))}` : entry.action}</p>
      {reason && <p>“{reason}”</p>}
      <p className="text-bark-muted">
        {formatDateTime(entry.created_at)} · {entry.actor ? en.orders.by(entry.actor.full_name) : en.orders.system}
      </p>
    </li>
  );
};

const OrderDetail = () => {
  const { id = '' } = useParams();
  const order = useAdminOrder(id);
  const history = useOrderHistory(id);
  const act = useOrderAction(id);
  const [action, setAction] = useState<AdminOrderAction | null>(null);

  if (order.isPending) return <SkeletonList rows={4} />;
  if (!order.data) return <ErrorState title={en.common.loadFailed} onRetry={() => { void order.refetch(); }} retryLabel={en.common.retry} />;
  const o = order.data;
  // Only what the state machine allows from here (the same list the API checks)
  const actions = adminOrderActions(o.status);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={en.orders.detailTitle(o.short_code)}
        intro={<StatusBadge status={o.status} method={o.payment_method} />}
        actions={<Button asChild size="sm" variant="ghost"><Link to="/orders">{en.common.back}</Link></Button>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={en.orders.buyer}>
              <p className="font-bold">{o.buyer.full_name}</p>
              <a href={telHref(o.buyer.phone)}>{formatPhone(o.buyer.phone)}</a>
              <Link to={`/orders?buyer=${o.buyer.id}`} className="text-sm">{en.orders.allFromBuyer}</Link>
            </Card>
            <Card title={en.orders.nursery}>
              <Link to={`/nurseries/${o.nursery.id}`} className="font-bold">{o.nursery.name}</Link>
              <a href={telHref(o.nursery.contact_phone)}>{formatPhone(o.nursery.contact_phone)}</a>
              <Link to={`/orders?nursery=${o.nursery.id}`} className="text-sm">{en.orders.allFromNursery}</Link>
            </Card>
            <Card title={en.orders.delivery}>
              {o.delivery_type === 'order_and_deliver' ? (
                <>
                  <p>{o.delivery_address}</p>
                  {o.distance_km !== null && <p className="text-bark-muted">{formatDistance(o.distance_km, 'road')}</p>}
                  {o.delivery_point && <p className="font-mono text-xs">{o.delivery_point.lat.toFixed(5)}, {o.delivery_point.lng.toFixed(5)}</p>}
                </>
              ) : (
                <p>{en.orders.collect}</p>
              )}
            </Card>
            <Card title={en.orders.payment}>
              <p>{en.insights.methods[o.payment_method]}{o.payment && o.payment_method !== 'trial' ? ` · ${formatPhone(o.payment.msisdn)}` : ''}</p>
              {o.paid_at && <p className="text-bark-muted">{formatDateTime(o.paid_at)}</p>}
            </Card>
          </div>
          <Card title={en.orders.items}>
            <table className="w-full text-sm">
              <tbody>
                {o.items.map(i => (
                  <tr key={i.inventory_id} className="border-b border-line">
                    <td className="py-1">{i.species.common_name}</td>
                    <td className="py-1 text-right tabular-nums">{i.quantity} × {formatUGX(i.unit_price)}</td>
                    <td className="py-1 text-right tabular-nums">{formatUGX(i.line_total)}</td>
                  </tr>
                ))}
                <tr><td className="py-1" colSpan={2}>{en.orders.delivery}</td><td className="py-1 text-right tabular-nums">{formatUGX(o.delivery_fee)}</td></tr>
                <tr className="font-bold"><td className="py-1" colSpan={2}>{en.orders.columns.total}</td><td className="py-1 text-right tabular-nums">{formatUGX(o.grand_total)}</td></tr>
              </tbody>
            </table>
          </Card>
          <Card title={en.orders.history}>
            {history.isPending && <SkeletonList rows={2} />}
            <ol className="mt-1">
              <li className="relative border-l-2 border-line pb-4 pl-4">
                <span aria-hidden className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-forest" />
                <p className="font-bold">{en.orders.statuses.pending_payment}</p>
                <p className="text-bark-muted">{formatDateTime(o.created_at)}</p>
              </li>
              {[...(history.data ?? [])].reverse().filter(e => e.action !== 'order.created').map(e => <HistoryItem key={e.id} entry={e} />)}
            </ol>
          </Card>
        </div>
        <aside aria-labelledby="actions" className="flex flex-col gap-3 self-start rounded-lg bg-paper shadow-card p-4 ring-1 ring-line">
          <h2 id="actions" className="text-base">{en.orders.actions}</h2>
          {actions.length === 0 && <p className="text-sm text-bark-muted">{en.orders.noActions}</p>}
          {actions.map(a => (
            <div key={a} className="flex flex-col gap-1">
              <Button variant={a === 'refunded' ? 'danger' : a === 'released' ? 'primary' : 'secondary'} onClick={() => { setAction(a); }}>{en.orders.action[a]}</Button>
              <p className="text-xs text-bark-muted">{en.orders.actionHelp[a]}</p>
            </div>
          ))}
        </aside>
      </div>
      <ReasonDialog
        open={action !== null}
        onOpenChange={open => { if (!open) setAction(null); }}
        title={action ? `${en.orders.action[action]} (${o.short_code})` : ''}
        description={action ? en.orders.actionHelp[action] : undefined}
        confirmLabel={action ? en.orders.action[action] : ''}
        danger={action === 'refunded'}
        busy={act.isPending}
        onConfirm={reason => {
          if (!action) return;
          act.mutate({ status: action, reason }, { onSuccess: () => { toast.success(en.orders.actionDone); setAction(null); }, onError: toastError });
        }}
      />
    </div>
  );
};
export default OrderDetail;
