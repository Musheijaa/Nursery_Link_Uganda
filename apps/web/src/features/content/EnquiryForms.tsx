import { zodResolver } from '@hookform/resolvers/zod';
import { generalEnquirySchema, serviceEnquirySchema } from '@nurserylink/shared';
import { Button, Checkbox, Field, Input, Textarea } from '@nurserylink/ui';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { en } from '../../copy/en';
import { applyApiError } from '../../lib/forms';
import { useSession } from '../../lib/session';
import { FormAlert } from '../auth/components';
import { useSendEnquiry, type ServiceCategory } from './api';

const t = en.enquiry;

/** People never see this field; bots fill it in, and the API then quietly drops the message. */
const SpamTrap = ({ register }: { register: () => object }) => (
  <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
    <label>
      {t.website}
      <input type="text" tabIndex={-1} autoComplete="off" {...register()} />
    </label>
  </div>
);

const Sent = ({ title, body, onAgain }: { title: string; body: string; onAgain: () => void }) => (
  <div role="status" className="flex flex-col items-start gap-3">
    <CheckCircle2 aria-hidden className="size-10 text-forest" />
    <h3 className="text-2xl">{title}</h3>
    <p>{body}</p>
    <Button variant="secondary" onClick={onAgain}>{t.another}</Button>
  </div>
);

type ServiceInput = z.input<typeof serviceEnquirySchema>;
type ServiceOutput = z.output<typeof serviceEnquirySchema>;

/** "Request this service" (Expert Services): who, where, which services, and what's needed. No account needed. */
export const ServiceRequestForm = ({ category }: { category: ServiceCategory }) => {
  const { user } = useSession();
  const mutation = useSendEnquiry();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<ServiceInput, unknown, ServiceOutput>({
    resolver: zodResolver(serviceEnquirySchema),
    mode: 'onTouched',
    defaultValues: {
      type: 'service',
      service_category_id: category.id,
      service_ids: [],
      name: user?.full_name ?? '',
      phone: user?.phone ?? '',
      organization: '',
      district: '',
      message: '',
      website: '',
    },
  });

  if (mutation.isSuccess) return <Sent title={t.sent} body={t.sentBody} onAgain={() => { mutation.reset(); reset(); }} />;

  return (
    <form
      noValidate
      className="relative flex flex-col gap-4"
      onSubmit={e => {
        setFormError(null);
        void handleSubmit(values => {
          mutation.mutate(
            { ...values, organization: values.organization || undefined },
            { onError: error => { setFormError(applyApiError(error, setError, ['name', 'phone', 'email', 'district', 'service_ids', 'message'])); } }
          );
        })(e);
      }}
    >
      {formError && <FormAlert>{formError}</FormAlert>}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-bold text-bark">{t.services}</legend>
        {category.services.map(s => (
          <Checkbox key={s.id} value={s.id} label={s.title} {...register('service_ids')} />
        ))}
        {errors.service_ids?.message && <p className="text-sm font-bold text-laterite">{errors.service_ids.message}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.name} error={errors.name?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="name" {...register('name')} />}
        </Field>
        <Field label={t.phone} hint={t.phoneHint} error={errors.phone?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />}
        </Field>
        <Field label={t.emailOptional} error={errors.email?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" autoComplete="email" {...register('email', { setValueAs: (v: string) => v || undefined })} />}
        </Field>
        <Field label={t.organizationOptional} error={errors.organization?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="organization" {...register('organization')} />}
        </Field>
        <Field label={t.district} error={errors.district?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} {...register('district')} />}
        </Field>
      </div>
      <Field label={t.message} hint={t.serviceMessageHint} error={errors.message?.message}>
        {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={5} {...register('message')} />}
      </Field>
      <Checkbox label={t.consent} {...register('consent')} />
      {errors.consent?.message && <p className="-mt-3 text-sm font-bold text-laterite">{errors.consent.message}</p>}
      <SpamTrap register={() => register('website')} />
      <Button type="submit" size="lg" className="self-start" disabled={mutation.isPending}>{t.sendRequest}</Button>
    </form>
  );
};

type GeneralInput = z.input<typeof generalEnquirySchema>;
type GeneralOutput = z.output<typeof generalEnquirySchema>;
export type GeneralEnquiryType = GeneralInput['type'];

/** Donate Now, Partner With Us and Contact Our Team: one form, three purposes. */
export const GeneralEnquiryForm = ({ type }: { type: GeneralEnquiryType }) => {
  const { user } = useSession();
  const mutation = useSendEnquiry();
  const [formError, setFormError] = useState<string | null>(null);
  const copy = t.general[type];
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<GeneralInput, unknown, GeneralOutput>({
    resolver: zodResolver(generalEnquirySchema),
    mode: 'onTouched',
    defaultValues: { type, name: user?.full_name ?? '', phone: user?.phone ?? '', organization: '', message: '', website: '' },
  });

  if (mutation.isSuccess) return <Sent title={copy.sent} body={t.sentBody} onAgain={() => { mutation.reset(); reset(); }} />;

  return (
    <form
      noValidate
      className="relative flex flex-col gap-4"
      onSubmit={e => {
        setFormError(null);
        void handleSubmit(values => {
          mutation.mutate(
            { ...values, organization: values.organization || undefined },
            { onError: error => { setFormError(applyApiError(error, setError, ['name', 'phone', 'email', 'message'])); } }
          );
        })(e);
      }}
    >
      {formError && <FormAlert>{formError}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.name} error={errors.name?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="name" {...register('name')} />}
        </Field>
        <Field label={t.organizationOptional} error={errors.organization?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="organization" {...register('organization')} />}
        </Field>
        <Field label={t.phoneOptional} hint={t.phoneOrEmail} error={errors.phone?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="tel" inputMode="tel" autoComplete="tel" {...register('phone', { setValueAs: (v: string) => v || undefined })} />}
        </Field>
        <Field label={t.emailOptional} error={errors.email?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" autoComplete="email" {...register('email', { setValueAs: (v: string) => v || undefined })} />}
        </Field>
      </div>
      <Field label={copy.message} hint={copy.messageHint} error={errors.message?.message}>
        {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={5} {...register('message')} />}
      </Field>
      <Checkbox label={t.consent} {...register('consent')} />
      {errors.consent?.message && <p className="-mt-3 text-sm font-bold text-laterite">{errors.consent.message}</p>}
      <SpamTrap register={() => register('website')} />
      <Button type="submit" size="lg" className="self-start" disabled={mutation.isPending}>{copy.submit}</Button>
    </form>
  );
};
