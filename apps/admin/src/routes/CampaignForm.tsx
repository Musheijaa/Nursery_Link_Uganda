import { isApiError } from '@nurserylink/api-client';
import { campaignCreateSchema, funderTypes, giveawayOfferTypes } from '@nurserylink/shared';
import { Button, Checkbox, EligibilityForm, ErrorState, Field, Input, Select, SkeletonList, Textarea, formatCount, formatPhone, toast } from '@nurserylink/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { RuleBuilder, toRules, type DraftRule } from '../features/campaigns/RuleBuilder';
import { useAdminCampaign, useSaveCampaign, type Campaign } from '../features/campaigns/api';
import { useSpeciesOptions } from '../features/inventory/api';
import { useDistricts, useNurseryOptions, useSubCounties } from '../features/nurseries/api';

interface Draft {
  title: string;
  funder_name: string;
  funder_type: Campaign['funder_type'];
  purpose: string;
  nursery_id: string;
  district_id: string;
  sub_county_id: string;
  starts: string;
  ends: string;
  is_active: boolean;
  items: { species_id: string; quantity: string }[];
  rules: DraftRule[];
  offer_type: Campaign['offer_type'];
  subsidised_price: string;
  eligibility_requirements: string;
  application_procedure: string;
  deadline: string;
  contact_phone: string;
  contact_email: string;
  website_url: string;
  distribution_locations: string;
  accepts_platform_applications: boolean;
}

// Campaigns run whole days in local time: from the start of the first day to the end of the last
const dayStart = (d: string) => new Date(`${d}T00:00:00`).toISOString();
const dayEnd = (d: string) => new Date(`${d}T23:59:59`).toISOString();
const toDay = (iso: string) => { const d = new Date(iso); return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const fromCampaign = (c: Campaign | undefined): Draft =>
  c
    ? {
        title: c.title, funder_name: c.funder_name, funder_type: c.funder_type, purpose: c.purpose, nursery_id: c.pickup_nursery?.id ?? '', district_id: '', sub_county_id: c.sub_county?.id ?? '',
        starts: toDay(c.starts_at), ends: toDay(c.ends_at), is_active: c.is_active,
        items: c.species.length ? c.species.map(s => ({ species_id: s.species_id, quantity: String(s.quantity) })) : [{ species_id: '', quantity: '' }],
        rules: c.eligibility_rules.map(r => ({ ...r })),
        offer_type: c.offer_type,
        subsidised_price: c.subsidised_price === null ? '' : String(c.subsidised_price),
        eligibility_requirements: c.eligibility_requirements ?? '',
        application_procedure: c.application_procedure ?? '',
        deadline: c.application_deadline ? toDay(c.application_deadline) : '',
        contact_phone: c.contact.phone ? formatPhone(c.contact.phone) : '',
        contact_email: c.contact.email ?? '',
        website_url: c.contact.website ?? '',
        distribution_locations: c.distribution_locations ?? '',
        accepts_platform_applications: c.accepts_platform_applications,
      }
    : {
        title: '', funder_name: '', funder_type: 'ngo', purpose: '', nursery_id: '', district_id: '', sub_county_id: '', starts: '', ends: '', is_active: true,
        items: [{ species_id: '', quantity: '' }], rules: [], offer_type: 'free', subsidised_price: '', eligibility_requirements: '', application_procedure: '',
        deadline: '', contact_phone: '', contact_email: '', website_url: '', distribution_locations: '', accepts_platform_applications: true,
      };

const orNull = (v: string) => (v.trim() ? v.trim() : null);

const Form = ({ campaign }: { campaign: Campaign | undefined }) => {
  const [d, setD] = useState<Draft>(() => fromCampaign(campaign));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveCampaign(campaign?.id ?? null);
  const navigate = useNavigate();
  const nurseries = useNurseryOptions();
  const species = useSpeciesOptions();
  const districts = useDistricts();
  const subs = useSubCounties(d.district_id || null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD(prev => ({ ...prev, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const rules = toRules(d.rules);
  const total = d.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  const submit = () => {
    setFormError(null);
    const platform = d.accepts_platform_applications;
    const candidate = {
      title: d.title, funder_name: d.funder_name, funder_type: d.funder_type, purpose: d.purpose,
      nursery_id: orNull(d.nursery_id), sub_county_id: orNull(d.sub_county_id),
      starts_at: d.starts ? dayStart(d.starts) : '', ends_at: d.ends ? dayEnd(d.ends) : '', is_active: d.is_active,
      eligibility_rules: platform ? rules : [],
      items: d.items.filter(i => i.species_id).map(i => ({ species_id: i.species_id, quantity: Number(i.quantity.replace(/,/g, '')) })),
      offer_type: d.offer_type,
      subsidised_price: d.offer_type === 'subsidised' ? Number(d.subsidised_price.replace(/,/g, '')) || 0 : null,
      eligibility_requirements: orNull(d.eligibility_requirements),
      application_procedure: orNull(d.application_procedure),
      application_deadline: d.deadline ? dayEnd(d.deadline) : null,
      contact_phone: orNull(d.contact_phone),
      contact_email: orNull(d.contact_email),
      website_url: orNull(d.website_url),
      distribution_locations: orNull(d.distribution_locations),
      accepts_platform_applications: platform,
    };
    // Same schema the API validates with
    const parsed = campaignCreateSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        next[key === 'starts_at' ? 'starts' : key === 'ends_at' ? 'ends' : key === 'eligibility_rules' ? 'rules' : key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    save.mutate(parsed.data, {
      onSuccess: c => { toast.success(en.campaigns.created); void navigate(`/giveaways/${c.id}`, { replace: true }); },
      onError: err => { setFormError(isApiError(err) ? err.message : en.common.loadFailed); },
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <form noValidate className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); submit(); }}>
        {formError && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{formError}</p>}
        <Field label={en.campaigns.campaignTitle} error={errors.title}>{({ id, describedBy, invalid }) => <Input id={id} value={d.title} onChange={e => { set('title', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={en.campaigns.funderName} error={errors.funder_name}>{({ id, describedBy, invalid }) => <Input id={id} value={d.funder_name} onChange={e => { set('funder_name', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
          <Field label={en.campaigns.funderType}>{({ id }) => <Select id={id} value={d.funder_type} onChange={e => { set('funder_type', e.target.value as Draft['funder_type']); }}>{funderTypes.map(t => <option key={t} value={t}>{en.campaigns.funderTypes[t]}</option>)}</Select>}</Field>
        </div>
        <Field label={en.campaigns.purpose} error={errors.purpose}>{({ id, describedBy, invalid }) => <Input id={id} value={d.purpose} onChange={e => { set('purpose', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={en.campaigns.offerType}>
            {({ id }) => (
              <Select id={id} value={d.offer_type} onChange={e => { set('offer_type', e.target.value as Draft['offer_type']); }}>
                {giveawayOfferTypes.map(o => <option key={o} value={o}>{en.campaigns.offerTypes[o]}</option>)}
              </Select>
            )}
          </Field>
          {d.offer_type === 'subsidised' && (
            <Field label={en.campaigns.subsidisedPrice} error={errors.subsidised_price}>
              {({ id, describedBy, invalid }) => <Input id={id} inputMode="numeric" value={d.subsidised_price} onChange={e => { set('subsidised_price', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}
            </Field>
          )}
        </div>
        <Field label={en.campaigns.eligibilityRequirements} hint={en.campaigns.optionalShown} error={errors.eligibility_requirements}>
          {({ id, describedBy, invalid }) => <Textarea id={id} rows={3} value={d.eligibility_requirements} onChange={e => { set('eligibility_requirements', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}
        </Field>
        <Field label={en.campaigns.applicationProcedure} hint={en.campaigns.optionalShown} error={errors.application_procedure}>
          {({ id, describedBy, invalid }) => <Textarea id={id} rows={3} value={d.application_procedure} onChange={e => { set('application_procedure', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}
        </Field>
        <Field label={en.campaigns.distributionLocations} hint={en.campaigns.optionalShown} error={errors.distribution_locations}>
          {({ id, describedBy, invalid }) => <Textarea id={id} rows={2} value={d.distribution_locations} onChange={e => { set('distribution_locations', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}
        </Field>
        <fieldset className="grid gap-3 rounded-lg bg-paper p-4 shadow-card ring-1 ring-line md:grid-cols-3">
          <legend className="font-bold">{en.campaigns.contactHeading}</legend>
          <Field label={en.campaigns.contactPhone} error={errors.contact_phone}>{({ id, describedBy, invalid }) => <Input id={id} type="tel" value={d.contact_phone} onChange={e => { set('contact_phone', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
          <Field label={en.campaigns.contactEmail} error={errors.contact_email}>{({ id, describedBy, invalid }) => <Input id={id} type="email" value={d.contact_email} onChange={e => { set('contact_email', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
          <Field label={en.campaigns.website} error={errors.website_url}>{({ id, describedBy, invalid }) => <Input id={id} type="url" placeholder="https://" value={d.website_url} onChange={e => { set('website_url', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
        </fieldset>
        <Checkbox
          label={en.campaigns.acceptsPlatform}
          checked={d.accepts_platform_applications}
          onChange={e => { set('accepts_platform_applications', e.target.checked); }}
        />
        {errors.accepts_platform_applications && <p role="alert" className="text-sm font-bold text-laterite">{errors.accepts_platform_applications}</p>}
        <Field label={en.campaigns.pickup} error={errors.nursery_id}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} value={d.nursery_id} onChange={e => { set('nursery_id', e.target.value); }} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
              <option value="">—</option>
              {nurseries.data?.filter(n => n.is_active || n.id === d.nursery_id).map(n => <option key={n.id} value={n.id}>{n.name} ({n.sub_county.name})</option>)}
            </Select>
          )}
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={en.nurseries.district}>
            {({ id }) => (
              <Select id={id} value={d.district_id} onChange={e => { setD(p => ({ ...p, district_id: e.target.value, sub_county_id: e.target.value ? '' : p.sub_county_id })); }}>
                <option value="">—</option>
                {districts.data?.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label={en.campaigns.subCounty} error={errors.sub_county_id}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} value={d.sub_county_id} disabled={!d.district_id} onChange={e => { set('sub_county_id', e.target.value); }} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
                <option value={campaign?.sub_county?.id ?? ''}>{campaign?.sub_county?.name ?? '—'}</option>
                {subs.data?.filter(s => s.id !== campaign?.sub_county?.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={en.campaigns.deadline} hint={en.campaigns.deadlineHint} error={errors.application_deadline}>{({ id, describedBy, invalid }) => <Input id={id} type="date" value={d.deadline} onChange={e => { set('deadline', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
          <Field label={en.campaigns.starts} error={errors.starts}>{({ id, describedBy, invalid }) => <Input id={id} type="date" value={d.starts} onChange={e => { set('starts', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
          <Field label={en.campaigns.ends} error={errors.ends}>{({ id, describedBy, invalid }) => <Input id={id} type="date" value={d.ends} onChange={e => { set('ends', e.target.value); }} aria-describedby={describedBy} invalid={invalid} />}</Field>
          <Checkbox label={en.campaigns.active} className="self-end" checked={d.is_active} onChange={e => { set('is_active', e.target.checked); }} />
        </div>

        <fieldset className="flex min-w-0 flex-col gap-2 rounded-lg bg-paper shadow-card p-4 ring-1 ring-line">
          <legend className="font-bold">{en.campaigns.items}</legend>
          {d.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select aria-label={`${en.inventory.species} ${String(i + 1)}`} className="min-h-9 flex-1 text-sm" value={item.species_id} onChange={e => { set('items', d.items.map((x, j) => (j === i ? { ...x, species_id: e.target.value } : x))); }}>
                <option value="">—</option>
                {species.data?.filter(s => s.id === item.species_id || !d.items.some(x => x.species_id === s.id)).map(s => <option key={s.id} value={s.id}>{s.common_name}</option>)}
              </Select>
              <input aria-label={`${en.inventory.quantity} ${String(i + 1)}`} inputMode="numeric" className="h-9 w-32 rounded-sm border border-field bg-paper px-2 text-right text-sm tabular-nums" value={item.quantity} onChange={e => { set('items', d.items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x))); }} />
              <Button size="sm" variant="ghost" aria-label={`${en.common.remove} ${String(i + 1)}`} disabled={d.items.length === 1} onClick={() => { set('items', d.items.filter((_, j) => j !== i)); }}><Trash2 aria-hidden /></Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button size="sm" variant="secondary" onClick={() => { set('items', [...d.items, { species_id: '', quantity: '' }]); }}><Plus aria-hidden />{en.campaigns.addItem}</Button>
            <span className="text-sm font-bold">{en.campaigns.allocated(formatCount(total))}</span>
          </div>
          {errors.items && <p role="alert" className="text-sm font-bold text-laterite">{errors.items}</p>}
        </fieldset>

        {d.accepts_platform_applications && <fieldset className="flex min-w-0 flex-col gap-2 rounded-lg bg-paper shadow-card p-4 ring-1 ring-line">
          <legend className="font-bold">{en.campaigns.rules}</legend>
          <p className="text-sm text-bark-muted">{en.campaigns.rulesHelp}</p>
          <RuleBuilder rules={d.rules} onChange={r => { set('rules', r); }} />
          {errors.rules && <p role="alert" className="text-sm font-bold text-laterite">{errors.rules}</p>}
        </fieldset>}
        <Button type="submit" busy={save.isPending} className="self-start">{en.common.save}</Button>
      </form>

      <aside aria-labelledby="preview" className="flex flex-col gap-2 self-start rounded-md border-l-4 border-sun bg-paper p-4 ring-1 ring-line xl:sticky xl:top-4">
        <h2 id="preview" className="text-base">{en.campaigns.previewHeading}</h2>
        <p className="text-sm text-bark-muted">{en.campaigns.previewNote}</p>
        <div ref={el => { el?.setAttribute('inert', ''); }} className="pointer-events-none">
          {/* Remount when the rules change so the preview always matches */}
          <EligibilityForm key={JSON.stringify(rules)} rules={rules} maxQuantity={Math.max(total, 1)} busy={false} onSubmit={() => undefined} />
        </div>
      </aside>
    </div>
  );
};

const CampaignForm = () => {
  const { id = null } = useParams();
  const editing = id !== null && id !== 'new';
  const existing = useAdminCampaign(editing ? id : null);
  if (editing && existing.isPending) return <SkeletonList rows={4} />;
  if (editing && !existing.data) return <ErrorState title={en.common.loadFailed} onRetry={() => { void existing.refetch(); }} retryLabel={en.common.retry} />;
  return (
    <div className="max-w-6xl">
      <PageHeader
        title={existing.data ? en.campaigns.editTitle(existing.data.title) : en.campaigns.newTitle}
        actions={
          <>
            {existing.data && <Button asChild size="sm" variant="secondary"><Link to={`/giveaways/${existing.data.id}/applications`}>{en.campaigns.applications}</Link></Button>}
            <Button asChild size="sm" variant="ghost"><Link to="/giveaways">{en.common.back}</Link></Button>
          </>
        }
      />
      <Form key={existing.data?.id ?? 'new'} campaign={existing.data} />
    </div>
  );
};
export default CampaignForm;
