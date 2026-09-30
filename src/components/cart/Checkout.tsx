import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Smartphone } from 'lucide-react';
import { DeliveryMethod, Order, PaymentNetwork } from '../../types';
import { CartItem, useApp } from '../../context/AppContext';
import { api, errorMessage } from '../../api/client';
import { useDeliveryQuotes, useDistricts, useHealth, useMe, useOrder } from '../../api/hooks';
import { formatNumber, formatUGX } from '../../utils/format';
import { detectNetwork, formatPhone, normaliseUgandanMobile } from '../../utils/phone';
import { Button, Field, inputClass } from '../ui';
import { PhoneSignIn } from '../auth/PhoneSignIn';

const NETWORK_MENUS: Record<PaymentNetwork, string> = {
  'MTN MoMo': '*165#',
  'Airtel Money': '*185#',
};

interface CheckoutProps {
  nurseryId: string;
  items: CartItem[];
  onViewOrders: () => void;
}

export const Checkout: React.FC<CheckoutProps> = ({ nurseryId, items, onViewOrders }) => {
  const { data: user } = useMe();
  const [orderId, setOrderId] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold">Verify your phone number</h3>
        <PhoneSignIn
          askName
          intro="We use your phone number to send your delivery code and order updates. You only need to do this once on this device."
        />
      </div>
    );
  }

  if (orderId) return <PaymentStatus orderId={orderId} nurseryId={nurseryId} onRetry={() => setOrderId(null)} onViewOrders={onViewOrders} />;

  return <DeliveryAndPayment nurseryId={nurseryId} items={items} defaultName={user.name ?? ''} defaultPhone={user.phone} onOrderCreated={setOrderId} />;
};

// ── Step 1: delivery and payment details ───────────────────

const DeliveryAndPayment: React.FC<{
  nurseryId: string;
  items: CartItem[];
  defaultName: string;
  defaultPhone: string;
  onOrderCreated: (orderId: string) => void;
}> = ({ nurseryId, items, defaultName, defaultPhone, onOrderCreated }) => {
  const { buyerDistrict } = useApp();
  const queryClient = useQueryClient();
  const { data: districts = [] } = useDistricts();
  const deliveryMethods = items[0]?.deliveryMethods ?? ['Collect from nursery'];

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(deliveryMethods[0]);
  const [district, setDistrict] = useState(buyerDistrict);
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [name, setName] = useState(defaultName);
  const [paymentPhone, setPaymentPhone] = useState('');
  // Null until the buyer picks a network; until then it follows the number's prefix
  const [networkChoice, setNetworkChoice] = useState<PaymentNetwork | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const seedlingCount = items.reduce((s, l) => s + l.quantity, 0);
  const seedlingsTotal = items.reduce((s, l) => s + l.quantity * l.unitPriceUGX, 0);
  const { data: quotes = [], isFetching: quoting } = useDeliveryQuotes(nurseryId, district, seedlingCount);
  const quote = quotes.find(q => q.method === deliveryMethod);
  const isCollection = deliveryMethod === 'Collect from nursery';
  const total = seedlingsTotal + (quote?.available ? quote.feeUGX : 0);

  const normalisedPaymentPhone = normaliseUgandanMobile(paymentPhone || defaultPhone);
  const detectedNetwork = normalisedPaymentPhone ? detectNetwork(normalisedPaymentPhone) : null;
  const network = networkChoice ?? detectedNetwork ?? 'MTN MoMo';
  const networkMismatch = detectedNetwork !== null && detectedNetwork !== network;

  const errors = {
    name: name.trim().length < 2 ? 'Enter your name' : null,
    area: !isCollection && area.trim().length < 2 ? 'Enter your village, parish or neighbourhood' : null,
    paymentPhone: !normalisedPaymentPhone ? 'Enter the number that will pay' : networkMismatch ? `This looks like an ${detectedNetwork} number` : null,
    delivery: quote && !quote.available ? quote.note : null,
  };
  const valid = Object.values(errors).every(e => e === null) && Boolean(quote);
  const showError = (key: keyof typeof errors) => (submitted ? errors[key] : null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (!valid) return;
    setSubmitting(true);
    try {
      const order = await api.post<Order>('/orders', {
        nurseryId,
        items: items.map(i => ({ batchId: i.batchId, quantity: i.quantity })),
        deliveryMethod,
        deliveryDistrict: isCollection ? '' : district,
        deliveryArea: area.trim(),
        deliveryLandmark: landmark.trim(),
        buyerName: name.trim(),
        paymentNetwork: network,
        paymentPhone: normalisedPaymentPhone,
      });
      queryClient.setQueryData(['order', order.id], order);
      onOrderCreated(order.id);
    } catch (err) {
      setServerError(errorMessage(err));
      // Stock may have changed; refresh listings so the buyer sees current numbers
      queryClient.invalidateQueries({ queryKey: ['nursery'] });
      queryClient.invalidateQueries({ queryKey: ['nurseries'] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-6" noValidate>
      <div>
        <p className="font-semibold">{items[0]?.nurseryName}</p>
        <p className="text-sm text-stone-500">{formatNumber(seedlingCount)} seedlings · {formatUGX(seedlingsTotal)}</p>
      </div>

      {!isCollection && (
        <Field label="Deliver to district">
          {id => (
            <select id={id} value={district} onChange={e => setDistrict(e.target.value)} className={inputClass}>
              {districts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          )}
        </Field>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">How will you get your seedlings?</legend>
        {deliveryMethods.map(method => {
          const q = quotes.find(x => x.method === method);
          return (
            <label
              key={method}
              className={`flex cursor-pointer items-start justify-between gap-3 rounded-md border p-3 text-sm ${
                deliveryMethod === method ? 'border-brand-600 bg-brand-50/50' : 'border-stone-200'
              } ${q && !q.available ? 'opacity-60' : ''}`}
            >
              <span className="flex items-start gap-2">
                <input type="radio" name="delivery" checked={deliveryMethod === method} onChange={() => setDeliveryMethod(method)} className="mt-0.5 accent-brand-700" />
                <span>
                  <span className="block font-medium">{method}</span>
                  <span className="block text-xs text-stone-500">{q ? `${q.note}${q.distanceKm ? ` · about ${q.distanceKm} km` : ''}` : 'Checking…'}</span>
                </span>
              </span>
              <span className="whitespace-nowrap font-medium">
                {!q ? '…' : q.available ? (q.feeUGX ? formatUGX(q.feeUGX) : 'Free') : 'Not available'}
              </span>
            </label>
          );
        })}
        {showError('delivery') && <p className="text-xs text-soil-700">{errors.delivery}. Choose another option.</p>}
      </fieldset>

      {!isCollection && (
        <div className="space-y-4">
          <Field label="Village, parish or neighbourhood" error={showError('area')}>
            {id => <input id={id} value={area} onChange={e => setArea(e.target.value)} className={inputClass} placeholder="e.g. Nansana, Kazo" />}
          </Field>
          <Field label="Nearest landmark" hint="Helps the rider find you, e.g. a school, church or trading centre">
            {id => <input id={id} value={landmark} onChange={e => setLandmark(e.target.value)} className={inputClass} />}
          </Field>
        </div>
      )}

      <Field label="Your name" error={showError('name')}>
        {id => <input id={id} value={name} onChange={e => setName(e.target.value)} className={inputClass} autoComplete="name" />}
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Pay with</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['MTN MoMo', 'Airtel Money'] as PaymentNetwork[]).map(n => (
            <label key={n} className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm font-medium ${network === n ? 'border-brand-600 bg-brand-50/50' : 'border-stone-200'}`}>
              <input type="radio" name="network" checked={network === n} onChange={() => setNetworkChoice(n)} className="accent-brand-700" />
              <span className={`h-3 w-3 rounded-full ${n === 'MTN MoMo' ? 'bg-yellow-400' : 'bg-red-600'}`} aria-hidden="true" />
              {n}
            </label>
          ))}
        </div>
        <Field label="Mobile Money number" hint={`Leave blank to pay from ${formatPhone(defaultPhone)}`} error={showError('paymentPhone')}>
          {id => (
            <input
              id={id}
              type="tel"
              inputMode="tel"
              value={paymentPhone}
              onChange={e => { setPaymentPhone(e.target.value); setNetworkChoice(null); }}
              className={inputClass}
              placeholder={formatPhone(defaultPhone)}
            />
          )}
        </Field>
      </fieldset>

      <dl className="space-y-1.5 border-t border-stone-200 pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-stone-600">Seedlings</dt><dd className="tabular-nums">{formatUGX(seedlingsTotal)}</dd></div>
        <div className="flex justify-between">
          <dt className="text-stone-600">{isCollection ? 'Collection' : 'Delivery'}</dt>
          <dd className="tabular-nums">{!quote || quoting ? '…' : quote.available ? (quote.feeUGX ? formatUGX(quote.feeUGX) : 'Free') : '–'}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatUGX(total)}</dd></div>
      </dl>

      {serverError && <p className="rounded-md bg-soil-50 p-3 text-sm text-soil-800" role="alert">{serverError}</p>}

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Sending payment request…' : `Pay ${formatUGX(total)}`}
        </Button>
        <p className="text-center text-xs text-stone-500">Your money is held until you confirm the seedlings arrived.</p>
      </div>
    </form>
  );
};

// ── Step 2: waiting for approval on the phone, then the result ──

const PaymentStatus: React.FC<{ orderId: string; nurseryId: string; onRetry: () => void; onViewOrders: () => void }> = ({
  orderId,
  nurseryId,
  onRetry,
  onViewOrders,
}) => {
  const queryClient = useQueryClient();
  const { removeNurseryFromCart } = useApp();
  const { data: health } = useHealth();
  const { data: order } = useOrder(orderId);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paid = Boolean(order && !['awaiting_payment', 'payment_failed', 'cancelled'].includes(order.status));

  // Once paid, the seedlings are reserved for this order: clear them from the cart and refresh stock
  useEffect(() => {
    if (!paid) return;
    removeNurseryFromCart(nurseryId);
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['nurseries'] });
    queryClient.invalidateQueries({ queryKey: ['nursery'] });
  }, [paid, nurseryId, queryClient, removeNurseryFromCart]);

  if (!order) return <p className="text-sm text-stone-600">Loading…</p>;

  const simulate = async (outcome: 'approve' | 'decline') => {
    setSimulating(true);
    setError(null);
    try {
      const updated = await api.post<Order>(`/orders/${orderId}/simulate-payment`, { outcome });
      queryClient.setQueryData(['order', orderId], updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSimulating(false);
    }
  };

  const cancel = async () => {
    try {
      await api.post(`/orders/${orderId}/cancel`);
    } finally {
      onRetry();
    }
  };

  if (paid) {
    return (
      <div className="space-y-5 text-sm">
        <div>
          <p className="text-lg font-semibold text-brand-800">Payment received</p>
          <p className="mt-1 text-stone-600">
            Order {order.orderNumber}. {formatUGX(order.totalUGX)} is on hold and will be paid to {order.nursery.name} after you confirm delivery.
          </p>
        </div>
        <div className="rounded-lg bg-stone-50 p-4">
          <p className="text-stone-600">Your delivery code</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em]">{order.deliveryCode}</p>
          <p className="mt-2 text-stone-700">
            Count and check your seedlings first, then give this code to the {order.deliveryMethod === 'Collect from nursery' ? 'nursery' : 'rider'}. We have also sent it to you by SMS.
          </p>
        </div>
        <Button className="w-full" onClick={onViewOrders}>Track your order</Button>
      </div>
    );
  }

  if (order.status === 'payment_failed' || order.status === 'cancelled') {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-lg font-semibold text-soil-800">Payment not completed</p>
        <p className="text-stone-700">{order.payment?.failureReason ?? 'The payment was not approved.'} No money was taken.</p>
        <Button className="w-full" onClick={onRetry}>Try again</Button>
      </div>
    );
  }

  const network = order.payment?.network ?? 'MTN MoMo';
  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-start gap-3 rounded-lg bg-stone-50 p-4">
        <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-brand-700" />
        <div>
          <p className="font-semibold">Check your phone</p>
          <p className="mt-1 text-stone-700">
            We sent a request for <strong>{formatUGX(order.totalUGX)}</strong> to {formatPhone(order.payment?.phone ?? order.buyer.phone)}.
            Enter your {network} PIN on your phone to approve it.
          </p>
          <p className="mt-2 text-stone-500">
            No prompt? Dial {NETWORK_MENUS[network]} and look for pending approvals. Never share your PIN with anyone.
          </p>
          <p className="mt-3 flex items-center gap-2 text-stone-500" aria-live="polite">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" /> Waiting for approval…
          </p>
        </div>
      </div>

      {health?.payments === 'simulated' && (
        <div className="space-y-3 rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p>Development mode: no real payment request is sent. Choose what the buyer does on their phone:</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => simulate('decline')} disabled={simulating} className="flex-1">Decline</Button>
            <Button size="sm" onClick={() => simulate('approve')} disabled={simulating} className="flex-1">Approve</Button>
          </div>
        </div>
      )}
      {error && <p className="text-soil-700" role="alert">{error}</p>}

      <button onClick={cancel} className="text-sm font-medium text-stone-600 hover:underline">Cancel this order</button>
    </div>
  );
};
