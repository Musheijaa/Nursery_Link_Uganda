import { nurseryCertificationSchema } from '@nurserylink/shared';
import { Button, Field, Input, formatDate, toast } from '@nurserylink/ui';
import { BadgeCheck } from 'lucide-react';
import { useState } from 'react';
import { en } from '../../copy/en';
import { toastError } from '../../lib/errors';
import { useCertifyNursery, type AdminNursery } from './api';

const t = en.nurseries;

/**
 * The certification record (brief §4.1): a nursery is Certified on the site only when an admin records the
 * certification they checked. Removing it makes the nursery Uncertified again. Both are audited.
 */
export const CertificationPanel = ({ nursery }: { nursery: AdminNursery }) => {
  const certify = useCertifyNursery(nursery.id);
  const [body, setBody] = useState(nursery.certification?.body ?? '');
  const [ref, setRef] = useState(nursery.certification?.ref ?? '');
  const [error, setError] = useState<string | undefined>();
  const record = nursery.certification;

  return (
    <section aria-labelledby="cert-heading" className="mt-6 flex max-w-2xl flex-col gap-3 rounded-lg bg-paper p-4 shadow-card ring-1 ring-line">
      <h2 id="cert-heading" className="text-lg">{t.certHeading}</h2>
      <p className="text-sm text-bark-muted">{t.certIntro}</p>
      {record ? (
        <p className="flex items-center gap-2 font-bold text-canopy">
          <BadgeCheck aria-hidden className="size-5" />
          {t.certRecorded(record.body, formatDate(record.verified_at))}{record.ref ? ` · ${record.ref}` : ''}
        </p>
      ) : (
        <p className="text-sm">{t.certNone}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.certBody} hint={t.certBodyHint} error={error}>
          {({ id, describedBy, invalid }) => <Input id={id} value={body} onChange={e => { setBody(e.target.value); setError(undefined); }} aria-describedby={describedBy} invalid={invalid} />}
        </Field>
        <Field label={t.certRef}>{({ id }) => <Input id={id} value={ref} onChange={e => { setRef(e.target.value); }} />}</Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          busy={certify.isPending}
          onClick={() => {
            const parsed = nurseryCertificationSchema.safeParse({ body, ref: ref.trim() || null });
            if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
            certify.mutate({ body: parsed.data.body, ref: parsed.data.ref ?? null }, { onSuccess: () => { toast.success(t.certSaved); }, onError: toastError });
          }}
        >
          <BadgeCheck aria-hidden />
          {t.certRecord}
        </Button>
        {record && (
          <Button size="sm" variant="secondary" disabled={certify.isPending} onClick={() => { certify.mutate(null, { onSuccess: () => { toast.success(t.certRemoved); }, onError: toastError }); }}>
            {t.certRemove}
          </Button>
        )}
      </div>
    </section>
  );
};
