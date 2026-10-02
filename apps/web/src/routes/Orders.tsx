import { Button, EmptyState, ErrorState, SkeletonList, formatDate, formatUGX } from '@nurserylink/ui';
import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { useMyOrders } from '../features/orders/api';
import { StatusBadge } from '../features/orders/StatusBadge';

/** My orders, newest first. */
const Orders = () => {
  usePageTitle(en.order.myOrders);
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const orders = useMyOrders(page);
  const pages = orders.data ? Math.max(1, Math.ceil(orders.data.meta.total / 10)) : 1;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl">{en.order.myOrders}</h1>
        <p className="text-bark-muted">{en.order.myOrdersIntro}</p>
      </header>
      {orders.isPending && <SkeletonList rows={3} label={en.order.myOrders} />}
      {orders.isError && !orders.data && <ErrorState title={en.order.loadFailed} onRetry={() => { void orders.refetch(); }} retryLabel={en.states.retry} />}
      {orders.data?.data.length === 0 && (
        <EmptyState title={en.order.noOrders} action={<Button asChild><Link to="/nurseries">{en.order.findNurseries}</Link></Button>}>
          {en.order.noOrdersBody}
        </EmptyState>
      )}
      {orders.data && orders.data.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {orders.data.data.map(o => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="flex items-center gap-3 rounded-lg bg-paper shadow-card p-4 no-underline ring-1 ring-line hover:ring-forest">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-canopy">{o.short_code}</span>
                    <StatusBadge status={o.status} delivery={o.delivery_type} method={o.payment_method} />
                  </span>
                  <span className="text-sm text-bark">{o.nursery.name}</span>
                  <span className="text-sm text-bark-muted">{formatDate(o.created_at)} · {formatUGX(o.grand_total)}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-forest" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav className="flex justify-between gap-2" aria-label={en.news.page(page, pages)}>
          <Button variant="secondary" disabled={page <= 1} onClick={() => { setParams({ page: String(page - 1) }); }}>{en.order.newerOrders}</Button>
          <Button variant="secondary" disabled={page >= pages} onClick={() => { setParams({ page: String(page + 1) }); }}>{en.order.olderOrders}</Button>
        </nav>
      )}
    </div>
  );
};
export default Orders;
