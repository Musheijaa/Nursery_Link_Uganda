import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Nursery, Order } from '../../types';
import { useApp } from '../../context/AppContext';
import { api, errorMessage } from '../../api/client';
import { queryKeys, useAdminOverview, useMe } from '../../api/hooks';
import { useSignOut } from '../../api/auth';
import { formatDate, formatNumber, formatUGX } from '../../utils/format';
import { formatPhone } from '../../utils/phone';
import { Badge, Button, Container, EmptyState, Field, Modal, PageHeader, inputClass } from '../ui';

export const AdminPage: React.FC = () => {
  const { navigate } = useApp();
  const { data: user, isLoading } = useMe();
  const signOut = useSignOut();
  const isAdmin = user?.role === 'admin';
  const { data: overview } = useAdminOverview(isAdmin);

  if (isLoading) return <Container className="py-10"><p className="text-stone-600">Loading…</p></Container>;
  if (!isAdmin) {
    return (
      <Container className="max-w-md space-y-4 py-10">
        <PageHeader title="Admin" intro="Sign in with an administrator account on the nursery sign-in page." />
        <Button onClick={() => navigate('nursery')}>Go to sign in</Button>
      </Container>
    );
  }

  return (
    <Container className="space-y-10 py-10">
      <PageHeader title="Admin" intro="Approve nurseries, resolve disputes and follow up failed payouts." actions={<Button variant="ghost" onClick={signOut}>Sign out</Button>} />

      {overview && (
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {[
            { label: 'Nurseries to review', value: overview.pendingNurseries },
            { label: 'Open disputes', value: overview.disputes },
            { label: 'Failed payouts', value: overview.failedPayouts },
            { label: 'Paid orders (30 days)', value: overview.orders30d },
            { label: 'Sales (30 days)', value: formatUGX(overview.sales30dUGX) },
            { label: 'Held for delivery', value: formatUGX(overview.heldUGX) },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-stone-200 bg-white p-4">
              <dt className="text-sm text-stone-500">{s.label}</dt>
              <dd className="mt-1 text-lg font-bold">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <PendingNurseries />
      <Disputes />
      <FailedPayouts />
    </Container>
  );
};

const useAdminAction = () => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const run = async (request: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await request();
      showToast(message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin });
      return true;
    } catch (err) {
      showToast(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
};

const PendingNurseries: React.FC = () => {
  const { data = [], isLoading } = useQuery({ queryKey: [...queryKeys.admin, 'nurseries'], queryFn: () => api.get<Nursery[]>('/admin/nurseries?status=pending') });
  const { run, busy } = useAdminAction();

  return (
    <section>
      <h2 className="text-xl font-bold">Nurseries waiting for approval</h2>
      <p className="mt-1 text-sm text-stone-600">Check the registration number with NFA, MAAIF or the district before approving.</p>
      <div className="mt-4 space-y-3">
        {isLoading && <p className="text-stone-600">Loading…</p>}
        {!isLoading && data.length === 0 && <EmptyState title="Nothing to review" />}
        {data.map(n => (
          <article key={n.id} className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5 lg:flex-row lg:justify-between">
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{n.name}</p>
              <p className="text-stone-600">{n.village}, {n.subCounty}, {n.district} · since {n.established}</p>
              <p className="text-stone-600">{n.operatorName} · {formatPhone(n.phone)}</p>
              <p><Badge tone="green">{n.registration}</Badge> <span className="font-mono">{n.registrationNumber}</span></p>
              <p className="text-stone-700">{n.description}</p>
            </div>
            <div className="flex shrink-0 gap-2 lg:flex-col">
              <Button disabled={busy} onClick={() => run(() => api.post(`/admin/nurseries/${n.id}/status`, { status: 'active' }), `${n.name} approved`)}>Approve</Button>
              <Button variant="danger" disabled={busy} onClick={() => run(() => api.post(`/admin/nurseries/${n.id}/status`, { status: 'suspended' }), `${n.name} rejected`)}>Reject</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

const OrderSummary: React.FC<{ order: Order }> = ({ order }) => {
  const lastNote = [...order.events].reverse().find(e => e.note)?.note;
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold">Order {order.orderNumber} · {formatUGX(order.totalUGX)}</p>
      <p className="text-stone-600">{order.nursery.name} ({order.nursery.district}) → {order.buyer.name}, {formatPhone(order.buyer.phone)}</p>
      <p className="text-stone-600">{order.items.map(i => `${formatNumber(i.quantity)} ${i.speciesName}`).join(', ')} · {formatDate(order.createdAt)}</p>
      {lastNote && <p className="text-stone-800">“{lastNote}”</p>}
    </div>
  );
};

const Disputes: React.FC = () => {
  const { data = [], isLoading } = useQuery({ queryKey: [...queryKeys.admin, 'disputes'], queryFn: () => api.get<Order[]>('/admin/orders?status=problem_reported') });
  const [resolving, setResolving] = useState<{ order: Order; action: 'release' | 'refund' } | null>(null);

  return (
    <section>
      <h2 className="text-xl font-bold">Disputes</h2>
      <p className="mt-1 text-sm text-stone-600">Call both the buyer and the nursery before deciding. Payment stays on hold until you do.</p>
      <div className="mt-4 space-y-3">
        {isLoading && <p className="text-stone-600">Loading…</p>}
        {!isLoading && data.length === 0 && <EmptyState title="No open disputes" />}
        {data.map(o => (
          <article key={o.id} className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5 lg:flex-row lg:justify-between">
            <OrderSummary order={o} />
            <div className="flex shrink-0 gap-2 lg:flex-col">
              <Button onClick={() => setResolving({ order: o, action: 'release' })}>Pay the nursery</Button>
              <Button variant="danger" onClick={() => setResolving({ order: o, action: 'refund' })}>Refund the buyer</Button>
            </div>
          </article>
        ))}
      </div>
      {resolving && <ResolveModal {...resolving} onClose={() => setResolving(null)} />}
    </section>
  );
};

const ResolveModal: React.FC<{ order: Order; action: 'release' | 'refund'; onClose: () => void }> = ({ order, action, onClose }) => {
  const { run, busy } = useAdminAction();
  const [note, setNote] = useState('');
  return (
    <Modal title={action === 'release' ? 'Pay the nursery' : 'Refund the buyer'} onClose={onClose}>
      <form
        className="space-y-4 text-sm"
        onSubmit={async e => {
          e.preventDefault();
          const ok = await run(() => api.post(`/admin/orders/${order.id}/resolve`, { action, note: note.trim() }), 'Dispute resolved');
          if (ok) onClose();
        }}
      >
        <p>
          {action === 'release'
            ? `${formatUGX(order.totalUGX)} will be sent to ${order.nursery.name}.`
            : `${formatUGX(order.totalUGX)} will be refunded to the buyer and the seedlings returned to stock.`}
        </p>
        <Field label="Reason for your decision" hint="Recorded in the order history">
          {id => <textarea id={id} rows={3} value={note} onChange={e => setNote(e.target.value)} className={`${inputClass} h-auto py-2`} />}
        </Field>
        <Button type="submit" className="w-full" disabled={busy || note.trim().length < 5}>Confirm</Button>
      </form>
    </Modal>
  );
};

const FailedPayouts: React.FC = () => {
  const { data = [], isLoading } = useQuery({ queryKey: [...queryKeys.admin, 'payouts'], queryFn: () => api.get<Order[]>('/admin/payouts/failed') });
  const { run, busy } = useAdminAction();
  return (
    <section>
      <h2 className="text-xl font-bold">Failed payouts</h2>
      <p className="mt-1 text-sm text-stone-600">Usually a wrong or unregistered Mobile Money number. Confirm the number with the recipient, then retry.</p>
      <div className="mt-4 space-y-3">
        {isLoading && <p className="text-stone-600">Loading…</p>}
        {!isLoading && data.length === 0 && <EmptyState title="No failed payouts" />}
        {data.map(o => (
          <article key={o.id} className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5 lg:flex-row lg:justify-between">
            <OrderSummary order={o} />
            <Button disabled={busy} onClick={() => run(() => api.post(`/admin/orders/${o.id}/retry-payout`), 'Payout retried')}>Retry payout</Button>
          </article>
        ))}
      </div>
    </section>
  );
};
