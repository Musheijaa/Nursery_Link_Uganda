import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Order } from '../../types';
import { useApp } from '../../context/AppContext';
import { api, errorMessage } from '../../api/client';
import { useMe, useOrders } from '../../api/hooks';
import { useSignOut } from '../../api/auth';
import { formatDate, formatNumber, formatUGX } from '../../utils/format';
import { formatPhone } from '../../utils/phone';
import { Badge, Button, Container, EmptyState, Field, Modal, PageHeader, inputClass } from '../ui';
import { PhoneSignIn } from '../auth/PhoneSignIn';
import { OrderProgress, STATUS_LABELS, statusTone } from './OrderProgress';

const ACTIVE_STATUSES: Order['status'][] = ['payment_held', 'being_prepared', 'on_the_way'];

export const OrdersPage: React.FC = () => {
  const { navigate } = useApp();
  const { data: user, isLoading: loadingUser } = useMe();
  const signOut = useSignOut();
  const { data: orders = [], isLoading, error } = useOrders(Boolean(user));
  const [confirming, setConfirming] = useState<Order | null>(null);
  const [reporting, setReporting] = useState<Order | null>(null);

  if (loadingUser) return <Container className="py-10"><p className="text-stone-600">Loading…</p></Container>;

  if (!user) {
    return (
      <Container className="max-w-md space-y-6 py-10">
        <PageHeader title="My orders" intro="Sign in with the phone number you used to order." />
        <PhoneSignIn onUsePassword={() => navigate('nursery')} />
      </Container>
    );
  }

  return (
    <Container className="space-y-6 py-10">
      <PageHeader
        title="My orders"
        intro={<>Signed in as {formatPhone(user.phone)}. Your payment stays on hold until you confirm the seedlings arrived in good condition.</>}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('seedlings')}>Order seedlings</Button>
            <Button variant="ghost" onClick={signOut}>Sign out</Button>
          </>
        }
      />

      {isLoading && <p className="text-stone-600">Loading your orders…</p>}
      {error && <EmptyState title="Could not load your orders">{errorMessage(error)}</EmptyState>}
      {!isLoading && !error && orders.length === 0 && (
        <EmptyState title="You have no orders yet">
          <button onClick={() => navigate('seedlings')} className="font-medium text-brand-700 hover:underline">Find a nursery</button>
        </EmptyState>
      )}

      <div className="space-y-5">
        {orders.map(order => (
          <article key={order.id} className="rounded-lg border border-stone-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-stone-200 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold">{order.nursery.name}</h2>
                <p className="text-sm text-stone-500">Order {order.orderNumber} · {formatDate(order.createdAt)}</p>
              </div>
              <Badge tone={statusTone(order.status)}>{STATUS_LABELS[order.status]}</Badge>
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-[3fr_2fr]">
              <div className="space-y-5">
                <OrderProgress status={order.status} />

                <table className="w-full text-sm">
                  <tbody className="divide-y divide-stone-100">
                    {order.items.map(item => (
                      <tr key={`${item.speciesId}-${item.seedlingType}`}>
                        <td className="py-2">
                          {item.speciesName}
                          <span className="text-stone-500"> · {item.seedlingType}</span>
                        </td>
                        <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums text-stone-600">{formatNumber(item.quantity)} × {formatUGX(item.unitPriceUGX)}</td>
                        <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">{formatUGX(item.quantity * item.unitPriceUGX)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 text-stone-600" colSpan={2}>
                        {order.deliveryMethod === 'Collect from nursery' ? 'Collection' : `Delivery by ${order.deliveryMethod.toLowerCase()} (${order.distanceKm} km)`}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">{order.deliveryFeeUGX ? formatUGX(order.deliveryFeeUGX) : 'Free'}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="py-2" colSpan={2}>Total</td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">{formatUGX(order.totalUGX)}</td>
                    </tr>
                  </tbody>
                </table>

                <p className="text-sm text-stone-600">
                  {order.deliveryMethod === 'Collect from nursery'
                    ? `You will collect from the nursery in ${order.nursery.district}.`
                    : <>Delivering to {order.deliveryArea}, {order.deliveryDistrict}{order.deliveryLandmark && ` (${order.deliveryLandmark})`}.</>}
                  {order.payment && <> Paying with {order.payment.network} from {formatPhone(order.payment.phone)}.</>}
                </p>
              </div>

              <OrderActions order={order} onConfirm={() => setConfirming(order)} onReport={() => setReporting(order)} />
            </div>
          </article>
        ))}
      </div>

      {confirming && <ConfirmDeliveryModal order={confirming} onClose={() => setConfirming(null)} />}
      {reporting && <ReportProblemModal order={reporting} onClose={() => setReporting(null)} />}
    </Container>
  );
};

const OrderActions: React.FC<{ order: Order; onConfirm: () => void; onReport: () => void }> = ({ order, onConfirm, onReport }) => {
  if (ACTIVE_STATUSES.includes(order.status)) {
    return (
      <div className="space-y-4 rounded-lg bg-stone-50 p-5">
        <div>
          <p className="text-sm text-stone-600">Your delivery code</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em] text-stone-900">{order.deliveryCode}</p>
        </div>
        <p className="text-sm text-stone-700">
          Count and check your seedlings first. Only then give this code to the {order.deliveryMethod === 'Collect from nursery' ? 'nursery' : 'rider'}; it releases your payment to them.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <Button onClick={onConfirm} disabled={order.status !== 'on_the_way'} className="flex-1">I have received my seedlings</Button>
          <Button variant="danger" onClick={onReport} className="flex-1">Report a problem</Button>
        </div>
        {order.status !== 'on_the_way' && (
          <p className="text-xs text-stone-500">You can confirm once the nursery has sent your order.</p>
        )}
      </div>
    );
  }

  const text: Partial<Record<Order['status'], string>> = {
    delivered: `Delivered. ${formatUGX(order.totalUGX)} ${order.payout?.status === 'successful' ? 'was paid' : 'is being paid'} to the nursery.`,
    problem_reported: 'Our support team will call you to resolve this. Your money stays on hold until it is sorted out.',
    cancelled: 'Cancelled. If you had paid, the money is refunded to the number you paid from.',
    payment_failed: order.payment?.failureReason ? `Payment not completed: ${order.payment.failureReason}.` : 'Payment not completed.',
    awaiting_payment: 'Approve the payment prompt on your phone to confirm this order.',
  };

  return <div className="rounded-lg bg-stone-50 p-5 text-sm text-stone-700">{text[order.status]}</div>;
};

const useOrderAction = (onDone: () => void) => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (request: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      await request();
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast(successMessage);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { run, error, busy };
};

const ConfirmDeliveryModal: React.FC<{ order: Order; onClose: () => void }> = ({ order, onClose }) => {
  const { run, error, busy } = useOrderAction(onClose);
  return (
    <Modal title="Confirm you received your seedlings" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p>This releases <strong>{formatUGX(order.totalUGX)}</strong> to {order.nursery.name}. You cannot undo this.</p>
        <p>Only continue if you have counted the seedlings and they are healthy.</p>
        {error && <p className="text-soil-700" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Not yet</Button>
          <Button
            onClick={() => run(() => api.post(`/orders/${order.id}/confirm-delivery`), `${formatUGX(order.totalUGX)} released to ${order.nursery.name}`)}
            disabled={busy}
            className="flex-1"
          >
            Yes, release payment
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const ReportProblemModal: React.FC<{ order: Order; onClose: () => void }> = ({ order, onClose }) => {
  const { run, error, busy } = useOrderAction(onClose);
  const [note, setNote] = useState('');
  return (
    <Modal title="Report a problem" onClose={onClose}>
      <form
        className="space-y-4 text-sm"
        onSubmit={e => {
          e.preventDefault();
          run(() => api.post(`/orders/${order.id}/report-problem`, { note: note.trim() }), 'Problem reported. Our support team will call you.');
        }}
      >
        <p>Your payment stays on hold while we sort this out with {order.nursery.name}.</p>
        <Field label="What went wrong?" error={error}>
          {id => (
            <textarea
              id={id}
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              className={`${inputClass} h-auto py-2`}
              placeholder="e.g. 40 seedlings missing, several arrived dried out"
            />
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={busy || note.trim().length < 5}>Send report</Button>
      </form>
    </Modal>
  );
};
