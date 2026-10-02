import { zodResolver } from '@hookform/resolvers/zod';
import { certificationStatuses, nurseryCreateSchema, nurseryTypes } from '@nurserylink/shared';
import { Button, Checkbox, ErrorState, Field, Input, Select, Skeleton, SkeletonList, formatPhone, toast } from '@nurserylink/ui';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import type { Feature } from 'geojson';
import type { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useAdminNursery, useBoundaryShape, useDistricts, useSaveNursery, useSubCounties } from '../features/nurseries/api';
import { applyApiError } from '../lib/forms';

const PointPicker = lazy(() => import('../features/nurseries/PointPicker'));

type Input = z.input<typeof nurseryCreateSchema>;
type Output = z.output<typeof nurseryCreateSchema>;

/** The location is unset until the map is clicked, whatever the form's type says. */
const pointOf = (v: Output['location'] | undefined) => v ?? null;
const coordsOf = (v: Output['location'] | undefined) => (v ? `${String(v.lat)}, ${String(v.lng)}` : '');

const parseCoords = (text: string) => {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

/** Add or edit a nursery: details, then its location on the map. */
const NurseryForm = () => {
  const { id = null } = useParams();
  const editing = id !== null && id !== 'new';
  const existing = useAdminNursery(editing ? id : null);
  const save = useSaveNursery(editing ? id : null);
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [coordsText, setCoordsText] = useState('');
  const [coordsError, setCoordsError] = useState<string | undefined>();
  const [zoomDistrict, setZoomDistrict] = useState<string | null>(null);
  const [zoomSub, setZoomSub] = useState<string | null>(null);
  const districts = useDistricts();
  const subs = useSubCounties(zoomDistrict);
  const shape = useBoundaryShape(zoomSub ?? zoomDistrict);

  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<Input, unknown, Output>({
    resolver: zodResolver(nurseryCreateSchema),
    defaultValues: { type: 'community', certification_status: 'unverified', is_active: true, annual_capacity: 0, seed_source: '' },
  });

  // Fill the form once the nursery has loaded
  useEffect(() => {
    const n = existing.data;
    if (!n) return;
    reset({
      name: n.name, type: n.type, location: n.location, operator_name: n.operator_name, contact_phone: formatPhone(n.contact_phone), payout_phone: formatPhone(n.payout_phone),
      annual_capacity: n.annual_capacity, seed_source: n.seed_source ?? '', certification_status: n.certification_status, is_active: n.is_active,
    });
  }, [existing.data, reset]);

  if (editing && existing.isPending) return <SkeletonList rows={4} />;
  if (editing && !existing.data) return <ErrorState title={en.common.loadFailed} onRetry={() => { void existing.refetch(); }} retryLabel={en.common.retry} />;

  const title = existing.data ? en.nurseries.editTitle(existing.data.name) : en.nurseries.newTitle;
  return (
    <div className="max-w-5xl">
      <PageHeader
        title={title}
        actions={
          <>
            {existing.data && (
              <Button asChild size="sm" variant="secondary"><Link to={`/orders?nursery=${existing.data.id}`}>{en.orders.nurseryOrders}</Link></Button>
            )}
            <Button asChild size="sm" variant="ghost"><Link to="/nurseries">{en.common.back}</Link></Button>
          </>
        }
      />
      <form
        noValidate
        className="grid gap-6 lg:grid-cols-2"
        onSubmit={e => {
          setFormError(null);
          void handleSubmit(values => {
            save.mutate({ ...values, seed_source: values.seed_source || null }, {
              onSuccess: n => {
                toast.success(editing ? en.common.changesSaved : en.nurseries.created, en.nurseries.derived(n.sub_county.name, n.district.name));
                void navigate(`/nurseries/${n.id}`, { replace: true });
              },
              onError: err => {
                setFormError(applyApiError(err, setError, ['name', 'contact_phone', 'payout_phone', 'location', 'operator_name', 'annual_capacity']));
              },
            });
          })(e);
        }}
      >
        <div className="flex flex-col gap-3">
          {existing.data?.is_demo && <p role="note" className="rounded-sm bg-amber-tint px-3 py-2 text-sm text-bark">{en.nurseries.sampleNote}</p>}
          {existing.data?.listing_note && (
            <div role="note" className="flex flex-col gap-1 rounded-sm bg-sky-tint px-3 py-2 text-sm text-bark">
              <p className="font-bold text-lake">{en.nurseries.importNoteTitle}</p>
              <p>{existing.data.listing_note}</p>
            </div>
          )}
          {formError && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{formError}</p>}
          <Field label={en.nurseries.name} error={errors.name?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} aria-describedby={describedBy} invalid={invalid} {...register('name')} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={en.nurseries.type}>{({ id: f }) => <Select id={f} {...register('type')}>{nurseryTypes.map(t => <option key={t} value={t}>{en.nurseries.types[t]}</option>)}</Select>}</Field>
            <Field label={en.nurseries.certification}>{({ id: f }) => <Select id={f} {...register('certification_status')}>{certificationStatuses.map(t => <option key={t} value={t}>{en.nurseries.certs[t]}</option>)}</Select>}</Field>
          </div>
          <Field label={en.nurseries.operator} error={errors.operator_name?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} aria-describedby={describedBy} invalid={invalid} {...register('operator_name')} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={en.nurseries.contactPhone} error={errors.contact_phone?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} type="tel" aria-describedby={describedBy} invalid={invalid} {...register('contact_phone')} />}</Field>
            <Field label={en.nurseries.payoutPhone} error={errors.payout_phone?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} type="tel" aria-describedby={describedBy} invalid={invalid} {...register('payout_phone')} />}</Field>
          </div>
          <Field label={en.nurseries.capacity} error={errors.annual_capacity?.message}>{({ id: f, describedBy, invalid }) => <Input id={f} inputMode="numeric" aria-describedby={describedBy} invalid={invalid} {...register('annual_capacity', { valueAsNumber: true })} />}</Field>
          <Field label={en.nurseries.seedSource}>{({ id: f }) => <Input id={f} {...register('seed_source')} />}</Field>
          <Checkbox label={en.nurseries.active} {...register('is_active')} />
          <Button type="submit" busy={save.isPending} className="self-start">{en.common.save}</Button>
        </div>

        <Controller
          control={control}
          name="location"
          render={({ field, fieldState }) => (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 font-bold">{en.nurseries.location}</legend>
              <p className="text-sm text-bark-muted">{en.nurseries.locationHelp}</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`${en.nurseries.zoomTo}: ${en.nurseries.district}`}>
                  {({ id: f }) => (
                    <Select id={f} value={zoomDistrict ?? ''} onChange={e => { setZoomDistrict(e.target.value || null); setZoomSub(null); }}>
                      <option value="">—</option>
                      {districts.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label={`${en.nurseries.zoomTo}: ${en.nurseries.subCounty}`}>
                  {({ id: f }) => (
                    <Select id={f} value={zoomSub ?? ''} disabled={!zoomDistrict} onChange={e => { setZoomSub(e.target.value || null); }}>
                      <option value="">—</option>
                      {subs.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
              <Suspense fallback={<Skeleton className="h-80 rounded-md" />}>
                <PointPicker
                  point={pointOf(field.value)}
                  onPick={p => { field.onChange(p); setCoordsText(`${String(p.lat)}, ${String(p.lng)}`); }}
                  boundary={(shape.data as unknown as Feature | undefined) ?? null}
                  label={en.nurseries.location}
                />
              </Suspense>
              <Field label={en.nurseries.coordinates} hint={en.nurseries.coordinatesHint} error={coordsError ?? (fieldState.error ? en.nurseries.pickLocation : undefined)}>
                {({ id: f, describedBy, invalid }) => (
                  <Input
                    id={f}
                    value={coordsText || coordsOf(field.value)}
                    onChange={e => { setCoordsText(e.target.value); setCoordsError(undefined); }}
                    onBlur={() => {
                      if (!coordsText) return;
                      const p = parseCoords(coordsText);
                      if (p) field.onChange(p);
                      else setCoordsError(en.nurseries.coordinatesInvalid);
                    }}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
              {existing.data && <p className="text-sm text-bark-muted">{en.nurseries.derived(existing.data.sub_county.name, existing.data.district.name)}</p>}
            </fieldset>
          )}
        />
      </form>
    </div>
  );
};
export default NurseryForm;
