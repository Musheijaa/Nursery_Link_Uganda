import { Button, Dialog, Field, Textarea } from '@nurserylink/ui';
import { useState, type ReactNode } from 'react';
import { en } from '../copy/en';

/** Every admin action on an order or payout asks why; the reason goes into the audit log. */
export const ReasonDialog = ({ open, onOpenChange, title, description, confirmLabel, danger, busy, onConfirm, optional = false, label = en.common.reasonLabel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  onConfirm: (reason: string) => void;
  optional?: boolean;
  label?: string;
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  return (
    <Dialog
      open={open}
      onOpenChange={o => { if (!o) { setReason(''); setError(undefined); } onOpenChange(o); }}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => { onOpenChange(false); }}>{en.common.cancel}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            busy={busy}
            onClick={() => {
              if (!optional && reason.trim().length < 5) { setError(en.common.reasonTooShort); return; }
              onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={label} hint={optional ? undefined : en.common.reasonHint} error={error}>
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} value={reason} onChange={e => { setReason(e.target.value); if (error) setError(undefined); }} aria-describedby={describedBy} invalid={invalid} maxLength={500} />
        )}
      </Field>
    </Dialog>
  );
};
