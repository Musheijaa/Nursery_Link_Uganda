import { isApiError } from '@nurserylink/api-client';
import { toE164UgandaMobile } from '@nurserylink/shared';
import { Button, OtpInput, formatPhone, toast } from '@nurserylink/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { en } from '../../copy/en';
import { requestCode, verify } from './api';
import { AuthCard, FormAlert } from './components';
import { safeNext } from '@nurserylink/ui';
import { useCountdown } from '../../lib/useCountdown';

/** Matches the API's 60-second resend cooldown. */
const RESEND_SECONDS = 60;

const VerifyPage = () => {
  const [params] = useSearchParams();
  const phone = toE164UgandaMobile(params.get('phone') ?? '');
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_SECONDS * 1000);
  const wait = useCountdown(resendAt);

  const confirm = useMutation({
    mutationFn: verify,
    onSuccess: user => {
      toast.success(en.auth.verify.verified, user.full_name);
      void navigate(next, { replace: true });
    },
    onError: err => {
      setError(isApiError(err) ? err.message : en.states.loadFailed);
      setCode('');
    },
  });

  const resend = useMutation({
    mutationFn: requestCode,
    onSuccess: () => {
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      toast.success(en.auth.verify.resent);
    },
    onError: err => {
      toast.error(isApiError(err) ? err.message : en.states.loadFailed);
    },
  });

  if (!phone) return <Navigate to="/register" replace />;

  const submit = (value: string) => {
    setError(null);
    confirm.mutate({ phone, code: value });
  };

  return (
    <AuthCard
      title={en.auth.verify.title}
      intro={en.auth.verify.intro(formatPhone(phone))}
      footer={<Link to="/register" className="underline">{en.auth.verify.wrongNumber}</Link>}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={e => {
          e.preventDefault();
          if (code.length === 6) submit(code);
          else setError('Enter the 6-digit code');
        }}
      >
        {error && <FormAlert>{error}</FormAlert>}
        <OtpInput label={en.auth.verify.codeLabel} value={code} onChange={setCode} onComplete={submit} invalid={Boolean(error)} disabled={confirm.isPending} autoFocus />
        <Button type="submit" size="lg" block busy={confirm.isPending}>
          {en.auth.verify.submit}
        </Button>
        <Button variant="ghost" disabled={wait > 0} busy={resend.isPending} onClick={() => { resend.mutate(phone); }}>
          {wait > 0 ? en.auth.verify.resendIn(wait) : en.auth.verify.resend}
        </Button>
      </form>
    </AuthCard>
  );
};
export default VerifyPage;
