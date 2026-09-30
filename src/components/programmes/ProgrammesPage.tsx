import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SeedlingProgramme } from '../../types';
import { api, errorMessage } from '../../api/client';
import { useDistricts, useMe, useProgrammes, useSpecies, useVouchers } from '../../api/hooks';
import { formatDate, formatNumber } from '../../utils/format';
import { Badge, Button, Container, EmptyState, Field, Modal, PageHeader, inputClass } from '../ui';
import { PhoneSignIn } from '../auth/PhoneSignIn';

export const ProgrammesPage: React.FC = () => {
  const { data: programmes = [], isLoading, error } = useProgrammes();
  const { data: species = [] } = useSpecies();
  const { data: user } = useMe();
  const { data: vouchers = [] } = useVouchers(Boolean(user));
  const [applyingTo, setApplyingTo] = useState<SeedlingProgramme | null>(null);

  const speciesList = (ids: string[]) => ids.map(id => species.find(s => s.id === id)?.commonName ?? id).join(', ');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        title="Free seedling programmes"
        intro="Organisations that give free seedlings to eligible farmers, groups and schools. Apply here, then collect your seedlings from a partner nursery with your voucher code."
      />

      {vouchers.length > 0 && (
        <section className="rounded-lg border border-brand-200 bg-brand-50 p-5">
          <h2 className="font-semibold text-brand-900">Your vouchers</h2>
          <ul className="mt-3 space-y-3">
            {vouchers.map(v => {
              const programme = programmes.find(p => p.id === v.programmeId);
              return (
                <li key={v.code} className="flex flex-col gap-2 rounded-md bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-lg font-bold tracking-wider text-brand-800">{v.code}</p>
                      <Badge tone={v.status === 'issued' ? 'green' : 'neutral'}>{v.status === 'issued' ? 'Ready to collect' : v.status === 'redeemed' ? 'Collected' : 'Cancelled'}</Badge>
                    </div>
                    <p className="text-sm text-stone-600">{formatNumber(v.seedlings)} seedlings · {programme?.title}</p>
                  </div>
                  {programme && v.status === 'issued' && (
                    <p className="text-sm text-stone-600 sm:text-right">
                      Collect before {formatDate(programme.deadline)} from<br className="hidden sm:block" />{' '}
                      {programme.collectionNurseries.map(n => `${n.name} (${n.district})`).join(', ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isLoading && <p className="text-stone-600">Loading programmes…</p>}
      {error && <EmptyState title="Could not load programmes">{errorMessage(error)}</EmptyState>}

      <div className="grid gap-6 lg:grid-cols-2">
        {programmes.map(p => {
          const remaining = p.totalSeedlings - p.seedlingsClaimed;
          const claimedPercent = Math.round((p.seedlingsClaimed / p.totalSeedlings) * 100);
          const alreadyApplied = vouchers.some(v => v.programmeId === p.id);
          const canApply = p.status === 'Open' && remaining > 0 && p.deadline >= today && !alreadyApplied;

          return (
            <article key={p.id} className="flex flex-col rounded-lg border border-stone-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{p.title}</h2>
                  <p className="text-sm text-stone-500">{p.sponsorName} · {p.sponsorType}</p>
                </div>
                <Badge tone={p.status === 'Open' && remaining > 0 ? 'green' : 'amber'} className="shrink-0">
                  {remaining <= 0 ? 'Fully given out' : p.status}
                </Badge>
              </div>

              <p className="mt-3 text-sm text-stone-700">{p.description}</p>

              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-stone-500">Where</dt>
                  <dd className="font-medium">{p.districts.length ? p.districts.join(', ') : 'Any district'}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Trees</dt>
                  <dd className="font-medium">{speciesList(p.speciesIds)}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Per applicant</dt>
                  <dd className="font-medium">Up to {formatNumber(p.maxPerApplicant)} seedlings</dd>
                </div>
                <div>
                  <dt className="text-stone-500">{p.status === 'Open' ? 'Closes' : 'Applications close'}</dt>
                  <dd className="font-medium">{formatDate(p.deadline)}</dd>
                </div>
              </dl>

              <div className="mt-4 text-sm">
                <p className="text-stone-500">You will need</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-stone-700">
                  {p.requirements.map(r => <li key={r}>{r}</li>)}
                </ul>
              </div>

              <div className="mt-auto pt-5">
                <div className="mb-1 flex justify-between text-xs text-stone-500">
                  <span>{formatNumber(p.seedlingsClaimed)} of {formatNumber(p.totalSeedlings)} seedlings given out</span>
                  <span>{claimedPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${claimedPercent}%` }} />
                </div>
                <Button className="mt-4 w-full" disabled={!canApply} onClick={() => setApplyingTo(p)}>
                  {alreadyApplied ? 'You have applied' : p.status === 'Opening soon' ? 'Not yet open' : remaining <= 0 ? 'Fully given out' : 'Apply'}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {applyingTo && <ApplicationForm programme={applyingTo} onClose={() => setApplyingTo(null)} />}
    </Container>
  );
};

const ApplicationForm: React.FC<{ programme: SeedlingProgramme; onClose: () => void }> = ({ programme, onClose }) => {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  const { data: allDistricts = [] } = useDistricts();
  const districtOptions = programme.districts.length ? programme.districts : allDistricts.map(d => d.name);
  const maxSeedlings = Math.min(programme.maxPerApplicant, programme.totalSeedlings - programme.seedlingsClaimed);

  const [name, setName] = useState(user?.name ?? '');
  const [district, setDistrict] = useState('');
  const [seedlings, setSeedlings] = useState(String(maxSeedlings));
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState<string | null>(null);

  const seedlingCount = parseInt(seedlings, 10);
  const seedlingsValid = seedlingCount >= 1 && seedlingCount <= maxSeedlings;
  const chosenDistrict = district || districtOptions[0] || '';

  if (!user) {
    return (
      <Modal title={`Apply: ${programme.title}`} onClose={onClose}>
        <PhoneSignIn askName intro="First, verify your phone number. Each phone number can apply once per programme." />
      </Modal>
    );
  }

  if (voucherCode) {
    return (
      <Modal title="Voucher issued" onClose={onClose}>
        <div className="space-y-4 text-sm">
          <p>Show this code at the collection nursery together with your national ID. We have also sent it to you by SMS.</p>
          <p className="rounded-md bg-brand-50 py-4 text-center font-mono text-2xl font-bold tracking-widest text-brand-800">{voucherCode}</p>
          <p>
            <strong>{formatNumber(seedlingCount)} seedlings</strong> from {programme.title}. Collect before {formatDate(programme.deadline)} from:
          </p>
          <ul className="list-inside list-disc text-stone-700">
            {programme.collectionNurseries.map(n => <li key={n.id}>{n.name} ({n.district})</li>)}
          </ul>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (name.trim().length < 2 || !seedlingsValid || !confirmed || !chosenDistrict) return;
    setBusy(true);
    try {
      const res = await api.post<{ code: string }>(`/programmes/${programme.id}/apply`, {
        name: name.trim(),
        district: chosenDistrict,
        seedlings: seedlingCount,
      });
      setVoucherCode(res.code);
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['programmes'] });
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Apply: ${programme.title}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Full name" error={submitted && name.trim().length < 2 ? 'Enter your name as it appears on your ID' : null}>
          {id => <input id={id} value={name} onChange={e => setName(e.target.value)} className={inputClass} autoComplete="name" />}
        </Field>
        <Field label="District where you will plant">
          {id => (
            <select id={id} value={chosenDistrict} onChange={e => setDistrict(e.target.value)} className={inputClass}>
              {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </Field>
        <Field
          label="Number of seedlings"
          hint={`Up to ${formatNumber(maxSeedlings)}`}
          error={submitted && !seedlingsValid ? `Choose between 1 and ${formatNumber(maxSeedlings)}` : null}
        >
          {id => <input id={id} type="number" inputMode="numeric" min={1} max={maxSeedlings} value={seedlings} onChange={e => setSeedlings(e.target.value)} className={inputClass} />}
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
          <span>
            I meet the requirements for this programme and will bring the documents when collecting.
            {submitted && !confirmed && <span className="block text-xs text-soil-700">Please confirm to continue</span>}
          </span>
        </label>
        {serverError && <p className="rounded-md bg-soil-50 p-3 text-sm text-soil-800" role="alert">{serverError}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Button>
      </form>
    </Modal>
  );
};
