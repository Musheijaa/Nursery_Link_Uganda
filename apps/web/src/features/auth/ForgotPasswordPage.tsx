import { isApiError } from '@nurserylink/api-client';
import { forgotPasswordSchema } from '@nurserylink/shared';
import { Button, Field, Input } from '@nurserylink/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { en } from '../../copy/en';
import { forgotPassword, type ForgotValues } from './api';
import { AuthCard, FormAlert } from './components';

/** An "@" means email (reset link); anything else is treated as a phone number (SMS code). */
const parse = (identifier: string) =>
  forgotPasswordSchema.safeParse(identifier.includes('@') ? { email: identifier.trim() } : { phone: identifier });

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: ForgotValues) => forgotPassword(body),
    onSuccess: (_data, body) => {
      if ('phone' in body) void navigate(`/reset-password?phone=${encodeURIComponent(body.phone)}`);
      else setEmailSent(true);
    },
    onError: err => { setFormError(isApiError(err) ? err.message : en.states.loadFailed); },
  });

  return (
    <AuthCard title={en.auth.forgot.title} intro={en.auth.forgot.intro}>
      {emailSent ? (
        <FormAlert tone="info">{en.auth.forgot.sentEmail}</FormAlert>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={e => {
            e.preventDefault();
            setFormError(null);
            const result = parse(identifier);
            if (!result.success) {
              setFieldError(result.error.issues[0]?.message ?? 'Enter your phone number or email');
              return;
            }
            setFieldError(undefined);
            mutation.mutate(result.data);
          }}
        >
          {formError && <FormAlert>{formError}</FormAlert>}
          <Field label={en.auth.forgot.identifierLabel} hint={en.auth.phoneHint} error={fieldError}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} value={identifier} onChange={e => { setIdentifier(e.target.value); }} autoComplete="username" autoCapitalize="none" aria-describedby={describedBy} invalid={invalid} />
            )}
          </Field>
          <Button type="submit" size="lg" block busy={mutation.isPending}>
            {en.auth.forgot.submit}
          </Button>
        </form>
      )}
    </AuthCard>
  );
};
export default ForgotPasswordPage;
