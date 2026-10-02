import { isApiError } from '@nurserylink/api-client';
import { passwordSchema, toE164UgandaMobile } from '@nurserylink/shared';
import { Button, OtpInput, formatPhone, toast } from '@nurserylink/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { en } from '../../copy/en';
import { resetPassword, type ResetValues } from './api';
import { AuthCard, FormAlert, PasswordField } from './components';

/** Reached from the SMS code flow (?phone=) or the emailed link (?token=). */
const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const phone = toE164UgandaMobile(params.get('phone') ?? '');
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ code?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: ResetValues) => resetPassword(body),
    onSuccess: () => {
      toast.success(en.auth.reset.done);
      void navigate('/login', { replace: true });
    },
    onError: err => { setFormError(isApiError(err) ? err.message : en.states.loadFailed); },
  });

  if (!token && !phone) return <Navigate to="/forgot-password" replace />;

  return (
    <AuthCard title={en.auth.reset.title} intro={phone ? en.auth.reset.codeIntro(formatPhone(phone)) : en.auth.reset.linkIntro}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={e => {
          e.preventDefault();
          setFormError(null);
          const next: typeof errors = {};
          const pw = passwordSchema.safeParse(password);
          if (!pw.success) next.password = pw.error.issues[0]?.message;
          if (!token && code.length !== 6) next.code = 'Enter the 6-digit code';
          setErrors(next);
          if (next.code || next.password) return;
          mutation.mutate(token ? { token, new_password: password } : { phone: phone ?? '', code, new_password: password });
        }}
      >
        {formError && <FormAlert>{formError}</FormAlert>}
        {!token && (
          <div className="flex flex-col gap-1">
            <OtpInput label={en.auth.verify.codeLabel} value={code} onChange={setCode} invalid={Boolean(errors.code)} autoFocus />
            {errors.code && <p className="text-sm font-bold text-laterite" role="alert">{errors.code}</p>}
          </div>
        )}
        <PasswordField
          label={en.auth.reset.newPasswordLabel}
          hint={en.auth.passwordHint}
          autoComplete="new-password"
          value={password}
          onChange={e => { setPassword(e.target.value); }}
          error={errors.password}
        />
        <Button type="submit" size="lg" block busy={mutation.isPending}>
          {en.auth.reset.submit}
        </Button>
      </form>
    </AuthCard>
  );
};
export default ResetPasswordPage;
