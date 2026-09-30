import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DeliveryMethod, ManagedNursery, Order, Registration, SeedlingBatch, SeedlingType, User } from '../../types';
import { useApp } from '../../context/AppContext';
import { api, errorMessage } from '../../api/client';
import { queryKeys, useDistricts, useMe, useMyNurseries, useNurseryOrders, useSpecies } from '../../api/hooks';
import { useSignOut } from '../../api/auth';
import { formatDate, formatNumber, formatUGX } from '../../utils/format';
import { formatPhone, normaliseUgandanMobile } from '../../utils/phone';
import { Badge, Button, Container, EmptyState, Field, PageHeader, inputClass } from '../ui';
import { PhoneSignIn } from '../auth/PhoneSignIn';
import { STATUS_LABELS, statusTone } from '../orders/OrderProgress';

const SEEDLING_TYPES: SeedlingType[] = ['Potted seedling', 'Root trainer', 'Grafted', 'Cutting'];
const DELIVERY_METHODS: DeliveryMethod[] = ['Collect from nursery', 'Boda boda', 'Truck'];
const REGISTRATIONS: Registration[] = ['NFA registered', 'MAAIF certified', 'District registered', 'Community group'];

export const NurseryPortalPage: React.FC = () => {
  const { navigate } = useApp();
  const { data: user, isLoading } = useMe();

  if (isLoading) return <Container className="py-10"><p className="text-stone-600">Loading…</p></Container>;

  if (user?.role === 'admin') {
    return (
      <Container className="max-w-xl space-y-6 py-10">
        <PageHeader title="Nursery owner tools" intro="You are signed in as an administrator." />
        <Button onClick={() => navigate('admin')}>Go to admin</Button>
      </Container>
    );
  }

  if (user?.role === 'nursery_owner') return <OwnerDashboard user={user} />;
  return <SignedOutPortal user={user ?? null} />;
};

// ── Sign in, forgotten password, and registration ──────────

const SignedOutPortal: React.FC<{ user: User | null }> = ({ user }) => {
  const [tab, setTab] = useState<'signin' | 'register'>(user ? 'register' : 'signin');

  return (
    <Container className="max-w-2xl space-y-6 py-10">
      <PageHeader
        title="For nursery owners"
        intro="List your seedlings, receive orders from buyers across Uganda, and get paid to your Mobile Money number when buyers confirm delivery."
      />
      <div className="flex gap-2 border-b border-stone-200" role="tablist">
        {([['signin', 'Sign in'], ['register', 'List your nursery']] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? 'border-brand-700 text-brand-800' : 'border-transparent text-stone-600 hover:text-stone-900'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'signin' ? <PasswordSignIn /> : <RegistrationForm user={user} />}
    </Container>
  );
};

const PasswordSignIn: React.FC = () => {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalised = normaliseUgandanMobile(phone);
    if (!normalised) {
      setError('Enter a Ugandan mobile number, e.g. 0772 123 456');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.post<{ user: User }>('/auth/login', { phone: normalised, password });
      queryClient.setQueryData(queryKeys.me, user);
      queryClient.removeQueries({ predicate: q => q.queryKey[0] !== 'me' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (resetting) return <PasswordReset onDone={() => setResetting(false)} />;

  return (
    <form onSubmit={submit} className="max-w-sm space-y-4" noValidate>
      <Field label="Phone number">
        {id => <input id={id} type="tel" inputMode="tel" autoComplete="username" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="07XX XXX XXX" />}
      </Field>
      <Field label="Password" error={error}>
        {id => <input id={id} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />}
      </Field>
      <Button type="submit" className="w-full" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      <button type="button" onClick={() => setResetting(true)} className="text-sm font-medium text-brand-700 hover:underline">
        Forgot your password?
      </button>
    </form>
  );
};

const PasswordReset: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const normalised = normaliseUgandanMobile(phone);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalised) return setError('Enter a Ugandan mobile number, e.g. 0772 123 456');
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ devCode?: string }>('/auth/otp/request', { phone: normalised });
      setDevCode(res.devCode ?? null);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.post<{ user: User }>('/auth/password/reset', { phone: normalised, code, newPassword });
      queryClient.setQueryData(queryKeys.me, user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm space-y-4">
      <h2 className="font-semibold">Reset your password</h2>
      {!sent ? (
        <form onSubmit={send} className="space-y-4" noValidate>
          <Field label="Phone number of your nursery account" error={error}>
            {id => <input id={id} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="07XX XXX XXX" />}
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>Send code by SMS</Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4" noValidate>
          {devCode && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Development mode: your code is <strong className="font-mono">{devCode}</strong>.
            </p>
          )}
          <Field label="Code from SMS">
            {id => <input id={id} inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={`${inputClass} font-mono tracking-[0.3em]`} />}
          </Field>
          <Field label="New password" hint="At least 8 characters" error={error}>
            {id => <input id={id} type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />}
          </Field>
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6 || newPassword.length < 8}>Set new password</Button>
        </form>
      )}
      <button onClick={onDone} className="text-sm font-medium text-stone-600 hover:underline">Back to sign in</button>
    </div>
  );
};

const RegistrationForm: React.FC<{ user: User | null }> = ({ user }) => {
  const queryClient = useQueryClient();
  const { data: districts = [] } = useDistricts();
  const [form, setForm] = useState({
    name: '',
    operatorName: user?.name ?? '',
    district: '',
    subCounty: '',
    village: '',
    registration: 'District registered' as Registration,
    registrationNumber: '',
    established: String(new Date().getFullYear() - 1),
    description: '',
    openingHours: 'Mon–Sat, 8:00am–5:00pm',
    deliveryMethods: ['Collect from nursery'] as DeliveryMethod[],
    payoutPhone: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="max-w-sm space-y-4">
        <p className="text-sm text-stone-700">
          Step 1 of 2: verify the phone number buyers will call. Listings go live after we check your registration details.
        </p>
        <PhoneSignIn askName />
      </div>
    );
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(f => ({ ...f, [key]: value }));
  const toggleMethod = (m: DeliveryMethod) =>
    set('deliveryMethods', form.deliveryMethods.includes(m) ? form.deliveryMethods.filter(x => x !== m) : [...form.deliveryMethods, m]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payoutPhone = form.payoutPhone ? normaliseUgandanMobile(form.payoutPhone) : undefined;
    if (form.payoutPhone && !payoutPhone) return setError('Enter a valid Mobile Money number for payouts');
    if (!form.deliveryMethods.length) return setError('Choose at least one way buyers can get seedlings');
    setBusy(true);
    try {
      const res = await api.post<{ user: User }>('/auth/register-nursery', {
        ...form,
        district: form.district || districts[0]?.name,
        established: parseInt(form.established, 10),
        payoutPhone: payoutPhone ?? undefined,
      });
      queryClient.setQueryData(queryKeys.me, res.user);
      queryClient.invalidateQueries({ queryKey: queryKeys.myNurseries });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <p className="text-sm text-stone-700">Step 2 of 2: tell buyers about your nursery. Signed in as {formatPhone(user.phone)}.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nursery name">{id => <input id={id} value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} />}</Field>
        <Field label="Your name">{id => <input id={id} value={form.operatorName} onChange={e => set('operatorName', e.target.value)} className={inputClass} />}</Field>
        <Field label="District">
          {id => (
            <select id={id} value={form.district || districts[0]?.name || ''} onChange={e => set('district', e.target.value)} className={inputClass}>
              {districts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Sub-county">{id => <input id={id} value={form.subCounty} onChange={e => set('subCounty', e.target.value)} className={inputClass} />}</Field>
        <Field label="Village or trading centre">{id => <input id={id} value={form.village} onChange={e => set('village', e.target.value)} className={inputClass} />}</Field>
        <Field label="Year started">{id => <input id={id} type="number" value={form.established} onChange={e => set('established', e.target.value)} className={inputClass} />}</Field>
        <Field label="Registration">
          {id => (
            <select id={id} value={form.registration} onChange={e => set('registration', e.target.value as Registration)} className={inputClass}>
              {REGISTRATIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </Field>
        <Field label="Registration number" hint="From your NFA, MAAIF, district or CBO certificate">
          {id => <input id={id} value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Opening hours">{id => <input id={id} value={form.openingHours} onChange={e => set('openingHours', e.target.value)} className={inputClass} />}</Field>
        <Field label="Mobile Money number for payouts" hint={`Leave blank to use ${formatPhone(user.phone)}`}>
          {id => <input id={id} type="tel" value={form.payoutPhone} onChange={e => set('payoutPhone', e.target.value)} className={inputClass} placeholder={formatPhone(user.phone)} />}
        </Field>
      </div>
      <Field label="About your nursery" hint="What you grow and who you supply, in a sentence or two">
        {id => <textarea id={id} rows={3} value={form.description} onChange={e => set('description', e.target.value)} className={`${inputClass} h-auto py-2`} />}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">How can buyers get seedlings?</legend>
        <div className="flex flex-wrap gap-4">
          {DELIVERY_METHODS.map(m => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.deliveryMethods.includes(m)} onChange={() => toggleMethod(m)} className="h-4 w-4 accent-brand-700" />
              {m}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Create a password" hint="At least 8 characters. You will use it with your phone number to sign in.">
        {id => <input id={id} type="password" autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} className={`${inputClass} sm:w-72`} />}
      </Field>
      {error && <p className="rounded-md bg-soil-50 p-3 text-sm text-soil-800" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit listing for review'}</Button>
    </form>
  );
};

// ── Signed-in owner dashboard ──────────────────────────────

const OwnerDashboard: React.FC<{ user: User }> = ({ user }) => {
  const signOut = useSignOut();
  const { data: nurseries = [], isLoading, error } = useMyNurseries(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nursery = nurseries.find(n => n.id === selectedId) ?? nurseries[0];

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        title={nursery?.name ?? 'Your nursery'}
        intro={<>Signed in as {user.name ?? formatPhone(user.phone)}.</>}
        actions={<Button variant="ghost" onClick={signOut}>Sign out</Button>}
      />

      {isLoading && <p className="text-stone-600">Loading…</p>}
      {error && <EmptyState title="Could not load your nursery">{errorMessage(error)}</EmptyState>}

      {nurseries.length > 1 && (
        <select value={nursery?.id} onChange={e => setSelectedId(e.target.value)} className={`${inputClass} sm:w-80`} aria-label="Nursery">
          {nurseries.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      )}

      {nursery && (
        <>
          {nursery.status !== 'active' && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {nursery.status === 'pending'
                ? 'Your listing is waiting for approval. We check your registration number, usually within two working days. You can add your stock now; buyers will see it once approved.'
                : 'Your listing is suspended and hidden from buyers. Contact support for details.'}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Seedlings in stock', value: formatNumber(nursery.batches.reduce((s, b) => s + b.quantityAvailable, 0)) },
              { label: 'Orders to handle', value: nursery.stats.openOrders.toString() },
              { label: 'Payments on hold', value: formatUGX(nursery.stats.heldUGX) },
              { label: 'Paid to you', value: formatUGX(nursery.stats.paidUGX) },
            ].map(stat => (
              <div key={stat.label} className="rounded-lg border border-stone-200 bg-white p-4">
                <dt className="text-sm text-stone-500">{stat.label}</dt>
                <dd className="mt-1 text-xl font-bold">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <NurseryOrders nurseryId={nursery.id} />
          <StockTable nursery={nursery} />
          <AddBatchForm nurseryId={nursery.id} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RedeemVoucher nurseryId={nursery.id} />
            <NurserySettings nursery={nursery} />
          </div>
        </>
      )}
    </Container>
  );
};

const NurseryOrders: React.FC<{ nurseryId: string }> = ({ nurseryId }) => {
  const [scope, setScope] = useState<'open' | 'all'>('open');
  const { data: orders = [], isLoading } = useNurseryOrders(nurseryId, scope);

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Orders</h2>
        <select value={scope} onChange={e => setScope(e.target.value as 'open' | 'all')} className="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm" aria-label="Which orders">
          <option value="open">To handle</option>
          <option value="all">All orders</option>
        </select>
      </div>
      <div className="mt-4 space-y-3">
        {isLoading && <p className="text-stone-600">Loading orders…</p>}
        {!isLoading && orders.length === 0 && (
          <EmptyState title={scope === 'open' ? 'No orders waiting' : 'No orders yet'}>New orders appear here once the buyer’s payment is on hold.</EmptyState>
        )}
        {orders.map(order => <NurseryOrderCard key={order.id} order={order} />)}
      </div>
    </section>
  );
};

const NurseryOrderCard: React.FC<{ order: Order }> = ({ order }) => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (request: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await request();
      await queryClient.invalidateQueries({ queryKey: ['nursery-orders'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myNurseries });
      showToast(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const seedlings = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const isCollection = order.deliveryMethod === 'Collect from nursery';

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Order {order.orderNumber}</span>
          <Badge tone={statusTone(order.status)}>{STATUS_LABELS[order.status]}</Badge>
        </div>
        <p className="text-stone-700">
          {order.items.map(i => `${formatNumber(i.quantity)} ${i.speciesName}`).join(', ')} · {formatNumber(seedlings)} seedlings · {formatUGX(order.totalUGX)}
        </p>
        <p className="text-stone-500">
          {order.buyer.name}, {formatPhone(order.buyer.phone)} · {order.deliveryMethod}
          {!isCollection && ` to ${order.deliveryArea}, ${order.deliveryDistrict}${order.deliveryLandmark ? ` (${order.deliveryLandmark})` : ''}`}
          {' '}· ordered {formatDate(order.createdAt)}
        </p>
      </div>

      <div className="shrink-0 space-y-2 lg:w-72">
        {order.status === 'payment_held' && (
          <Button className="w-full" disabled={busy} onClick={() => act(() => api.post(`/my/orders/${order.id}/advance`, { to: 'being_prepared' }), 'Order marked as being prepared')}>
            Start preparing
          </Button>
        )}
        {order.status === 'being_prepared' && (
          <Button className="w-full" disabled={busy} onClick={() => act(() => api.post(`/my/orders/${order.id}/advance`, { to: 'on_the_way' }), isCollection ? 'Buyer told the order is ready' : 'Buyer told the order is on the way')}>
            {isCollection ? 'Ready for collection' : 'Mark as dispatched'}
          </Button>
        )}
        {order.status === 'on_the_way' && (
          <form
            onSubmit={e => {
              e.preventDefault();
              act(() => api.post(`/my/orders/${order.id}/confirm-delivery`, { code }), 'Delivery confirmed. Payment is on its way to your Mobile Money.');
            }}
            className="space-y-2"
          >
            <Field label="Buyer’s delivery code">
              {id => (
                <input id={id} inputMode="numeric" maxLength={4} value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(null); }}
                  className={`${inputClass} font-mono tracking-widest`} placeholder="4-digit code" />
              )}
            </Field>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 4}>Confirm delivery and get paid</Button>
          </form>
        )}
        {order.status === 'problem_reported' && <p className="text-sm text-soil-700">The buyer reported a problem. Our support team will call you.</p>}
        {order.status === 'delivered' && (
          <p className="text-sm text-stone-600">Delivered. Payout {order.payout?.status === 'successful' ? 'sent' : order.payout?.status === 'failed' ? 'failed; support will retry' : 'in progress'}.</p>
        )}
        {error && <p className="text-sm text-soil-700" role="alert">{error}</p>}
      </div>
    </article>
  );
};

const StockTable: React.FC<{ nursery: ManagedNursery }> = ({ nursery }) => {
  const { data: species = [] } = useSpecies();
  return (
    <section>
      <h2 className="text-xl font-bold">Stock and prices</h2>
      <p className="mt-1 text-sm text-stone-600">Changes are saved when you leave a field.</p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-4 py-3 font-medium">Seedling</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Price (UGX)</th>
              <th className="px-4 py-3 font-medium">In stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {nursery.batches.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-500">No batches yet. Add your first one below.</td></tr>
            )}
            {nursery.batches.map(batch => (
              // Keyed on the values so rows reset when stock changes elsewhere (e.g. a new order)
              <StockRow
                key={`${batch.id}-${batch.quantityAvailable}-${batch.unitPriceUGX}-${batch.status}`}
                batch={batch}
                speciesName={species.find(s => s.id === batch.speciesId)?.commonName ?? batch.speciesId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const StockRow: React.FC<{ batch: SeedlingBatch; speciesName: string }> = ({ batch, speciesName }) => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [price, setPrice] = useState(String(batch.unitPriceUGX));
  const [stock, setStock] = useState(String(batch.quantityAvailable));

  const save = async (changes: Partial<Pick<SeedlingBatch, 'unitPriceUGX' | 'quantityAvailable' | 'status'>>) => {
    try {
      await api.patch(`/my/batches/${batch.id}`, changes);
      showToast(`${speciesName} updated`);
    } catch (err) {
      showToast(errorMessage(err));
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.myNurseries });
  };

  const saveNumber = (field: 'unitPriceUGX' | 'quantityAvailable', raw: string, reset: (v: string) => void) => {
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 0) return reset(String(batch[field]));
    if (value !== batch[field]) save({ [field]: value });
  };

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="font-medium">{speciesName}</div>
        <div className="text-xs text-stone-500">{batch.seedlingType} · {batch.ageMonths} months · {batch.heightCm} cm</div>
      </td>
      <td className="px-4 py-3">
        <select value={batch.status} onChange={e => save({ status: e.target.value as SeedlingBatch['status'] })} className="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm" aria-label={`Status of ${speciesName}`}>
          <option value="Ready">Ready</option>
          <option value="Ready soon">Ready soon</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input type="number" inputMode="numeric" min={50} step={50} value={price} onChange={e => setPrice(e.target.value)}
          onBlur={() => saveNumber('unitPriceUGX', price, setPrice)} className="h-9 w-28 rounded-md border border-stone-300 px-2 text-sm tabular-nums" aria-label={`Price of ${speciesName}`} />
      </td>
      <td className="px-4 py-3">
        <input type="number" inputMode="numeric" min={0} value={stock} onChange={e => setStock(e.target.value)}
          onBlur={() => saveNumber('quantityAvailable', stock, setStock)} className="h-9 w-28 rounded-md border border-stone-300 px-2 text-sm tabular-nums" aria-label={`Stock of ${speciesName}`} />
      </td>
    </tr>
  );
};

const AddBatchForm: React.FC<{ nurseryId: string }> = ({ nurseryId }) => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const { data: species = [] } = useSpecies();
  const [speciesId, setSpeciesId] = useState('');
  const [seedlingType, setSeedlingType] = useState<SeedlingType>('Potted seedling');
  const [ageMonths, setAgeMonths] = useState('4');
  const [heightCm, setHeightCm] = useState('30');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post(`/my/nurseries/${nurseryId}/batches`, {
        speciesId: speciesId || species[0]?.id,
        seedlingType,
        ageMonths: parseInt(ageMonths, 10),
        heightCm: parseInt(heightCm, 10),
        unitPriceUGX: parseInt(price, 10),
        quantityAvailable: parseInt(quantity, 10),
      });
      setPrice('');
      setQuantity('');
      showToast('Batch added to your stock list');
      queryClient.invalidateQueries({ queryKey: queryKeys.myNurseries });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-6">
      <h2 className="text-xl font-bold">Add a batch</h2>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" noValidate>
        <Field label="Tree">
          {id => (
            <select id={id} value={speciesId || species[0]?.id || ''} onChange={e => setSpeciesId(e.target.value)} className={inputClass}>
              {species.map(s => <option key={s.id} value={s.id}>{s.commonName}</option>)}
            </select>
          )}
        </Field>
        <Field label="Seedling type">
          {id => (
            <select id={id} value={seedlingType} onChange={e => setSeedlingType(e.target.value as SeedlingType)} className={inputClass}>
              {SEEDLING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age (months)">{id => <input id={id} type="number" min={1} value={ageMonths} onChange={e => setAgeMonths(e.target.value)} className={inputClass} />}</Field>
          <Field label="Height (cm)">{id => <input id={id} type="number" min={1} value={heightCm} onChange={e => setHeightCm(e.target.value)} className={inputClass} />}</Field>
        </div>
        <Field label="Price per seedling (UGX)">{id => <input id={id} type="number" min={50} step={50} value={price} onChange={e => setPrice(e.target.value)} className={inputClass} placeholder="e.g. 800" />}</Field>
        <Field label="Quantity">{id => <input id={id} type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} placeholder="e.g. 2000" />}</Field>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={busy || !price || !quantity}>Add batch</Button>
        </div>
        {error && <p className="text-sm text-soil-700 sm:col-span-2 lg:col-span-3" role="alert">{error}</p>}
      </form>
    </section>
  );
};

const RedeemVoucher: React.FC<{ nurseryId: string }> = ({ nurseryId }) => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const v = await api.post<{ seedlings: number; applicantName: string; programme: string }>(`/my/nurseries/${nurseryId}/vouchers/redeem`, { code });
      setResult({ ok: true, text: `Valid. Give ${v.applicantName} ${formatNumber(v.seedlings)} seedlings (${v.programme}).` });
      setCode('');
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-6">
      <h2 className="text-lg font-bold">Free seedling vouchers</h2>
      <p className="mt-1 text-sm text-stone-600">When a farmer collects free seedlings, check their ID and redeem their voucher code here.</p>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="NLV-123-456" className={`${inputClass} font-mono`} aria-label="Voucher code" />
        <Button type="submit" disabled={busy || code.length < 11}>Redeem</Button>
      </form>
      {result && <p className={`mt-3 text-sm ${result.ok ? 'text-brand-800' : 'text-soil-700'}`} role="status">{result.text}</p>}
    </section>
  );
};

const NurserySettings: React.FC<{ nursery: ManagedNursery }> = ({ nursery }) => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [openingHours, setOpeningHours] = useState(nursery.openingHours);
  const [payoutPhone, setPayoutPhone] = useState(nursery.payoutPhone);
  const [methods, setMethods] = useState<DeliveryMethod[]>(nursery.deliveryMethods);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalised = normaliseUgandanMobile(payoutPhone);
    if (!normalised) return setError('Enter a valid Mobile Money number');
    if (!methods.length) return setError('Choose at least one way buyers can get seedlings');
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/my/nurseries/${nursery.id}`, { openingHours, payoutPhone: normalised, deliveryMethods: methods });
      showToast('Nursery details saved');
      queryClient.invalidateQueries({ queryKey: queryKeys.myNurseries });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-6">
      <h2 className="text-lg font-bold">Payout and delivery settings</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Field label="Mobile Money number for payouts" hint={`Currently ${nursery.payoutNetwork}`}>
          {id => <input id={id} type="tel" value={payoutPhone} onChange={e => setPayoutPhone(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Opening hours">{id => <input id={id} value={openingHours} onChange={e => setOpeningHours(e.target.value)} className={inputClass} />}</Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Delivery options</legend>
          <div className="flex flex-wrap gap-4">
            {DELIVERY_METHODS.map(m => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={methods.includes(m)} onChange={() => setMethods(ms => (ms.includes(m) ? ms.filter(x => x !== m) : [...ms, m]))} className="h-4 w-4 accent-brand-700" />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-sm text-soil-700" role="alert">{error}</p>}
        <Button type="submit" variant="secondary" disabled={busy}>Save settings</Button>
      </form>
    </section>
  );
};
