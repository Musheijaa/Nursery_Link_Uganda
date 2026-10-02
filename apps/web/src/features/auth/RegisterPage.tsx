import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@nurserylink/shared';
import { Button, Field, Input, safeNext, toast } from '@nurserylink/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { en } from '../../copy/en';
import { applyApiError } from '../../lib/forms';
import { register as registerAccount } from './api';
import { AuthCard, FormAlert, PasswordField } from './components';
import { withNext } from '@nurserylink/ui';

type Input = z.input<typeof registerSchema>;
type Output = z.output<typeof registerSchema>;

const RegisterPage = () => {
  const [params] = useSearchParams();
  const next = params.get('next');
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Input, unknown, Output>({ resolver: zodResolver(registerSchema), mode: 'onTouched' });

  const mutation = useMutation({
    mutationFn: registerAccount,
    onSuccess: ({ user, tokens }) => {
      if (tokens) {
        // Phone verification is switched off: already signed in
        toast.success(en.auth.register.welcome(user.full_name));
        void navigate(safeNext(next), { replace: true });
        return;
      }
      void navigate(withNext(`/verify?phone=${encodeURIComponent(user.phone)}`, next));
    },
    onError: error => {
      setFormError(applyApiError(error, setError, ['full_name', 'phone', 'password', 'email']));
    },
  });

  return (
    <AuthCard
      title={en.auth.register.title}
      intro={en.auth.register.intro}
      footer={
        <p>
          {en.auth.register.haveAccount} <Link to={withNext('/login', next)} className="underline">{en.auth.register.signInLink}</Link>
        </p>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={e => {
          setFormError(null);
          void handleSubmit(values => { mutation.mutate({ ...values, email: values.email || undefined }); })(e);
        }}
      >
        {formError && <FormAlert>{formError}</FormAlert>}
        <Field label={en.auth.register.nameLabel} error={errors.full_name?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-describedby={describedBy} invalid={invalid} {...register('full_name')} />}
        </Field>
        <Field label={en.auth.phoneLabel} hint={en.auth.phoneHint} error={errors.phone?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel" aria-describedby={describedBy} invalid={invalid} {...register('phone')} />}
        </Field>
        <PasswordField label={en.auth.passwordLabel} hint={en.auth.passwordHint} autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Field label={en.auth.register.emailLabel} hint={en.auth.register.emailHint} error={errors.email?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-describedby={describedBy}
              invalid={invalid}
              {...register('email', { setValueAs: (v: string) => (v.trim() === '' ? undefined : v) })}
            />
          )}
        </Field>
        <Button type="submit" size="lg" block busy={mutation.isPending}>
          {en.auth.register.submit}
        </Button>
      </form>
    </AuthCard>
  );
};
export default RegisterPage;
