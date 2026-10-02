import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError, unwrap } from '@nurserylink/api-client';
import { loginSchema } from '@nurserylink/shared';
import { BrandMark, Button, Field, Input, safeNext } from '@nurserylink/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { en } from '../../copy/en';
import { api, session } from '../../lib/api';
import { mediaSrc } from '../../lib/media';

type Input = z.input<typeof loginSchema>;
type Output = z.output<typeof loginSchema>;

const LoginPage = () => {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sentAsNonAdmin = (location.state as { notAdmin?: boolean } | null)?.notAdmin === true;
  const [formError, setFormError] = useState<string | null>(sentAsNonAdmin ? en.login.notAdmin : null);
  const { register, handleSubmit, formState: { errors } } = useForm<Input, unknown, Output>({ resolver: zodResolver(loginSchema) });

  useEffect(() => { document.title = `${en.login.title} · ${en.app.name}`; }, []);

  const mutation = useMutation({
    mutationFn: async (body: Output) => (await unwrap(api.POST('/auth/login', { body }))).data,
    onSuccess: tokens => {
      // Buyers have accounts too, but the console is for administrators only
      if (tokens.user.role !== 'admin') {
        setFormError(en.login.notAdmin);
        return;
      }
      session.signIn(tokens);
      void navigate(safeNext(params.get('next')), { replace: true });
    },
    onError: err => { setFormError(isApiError(err) ? err.message : en.states.loadFailed); },
  });

  return (
    // A nursery photo, darkened under canopy green, behind the sign-in card
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-canopy p-4">
      <picture className="contents">
        <source type="image/webp" srcSet={`${mediaSrc('/images/hero-nursery-beds-960.webp')} 960w, ${mediaSrc('/images/hero-nursery-beds-1400.webp')} 1400w`} sizes="100vw" />
        <img src={mediaSrc('/images/hero-nursery-beds.jpg')} alt="" width={1400} height={933} className="absolute inset-0 -z-10 size-full object-cover opacity-35" />
      </picture>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-canopy via-canopy/80 to-canopy/40" />
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-lg bg-paper p-7 shadow-lift ring-1 ring-line">
        <div className="flex items-center gap-2.5">
          <BrandMark size={40} className="shrink-0 rounded-[10px]" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-xl font-semibold tracking-tight text-canopy">{en.app.shortName}</span>
            <span className="text-xs font-bold text-murram">{en.app.consoleLabel}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl">{en.login.title}</h1>
          <p className="text-sm text-bark-muted">{en.login.tagline}</p>
        </div>
        <form noValidate className="flex flex-col gap-3" onSubmit={e => { setFormError(null); void handleSubmit(v => { mutation.mutate(v); })(e); }}>
          {formError && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 font-bold text-laterite">{formError}</p>}
          <Field label={en.login.identifierLabel} error={errors.identifier && en.login.identifierRequired}>
            {({ id, describedBy, invalid }) => <Input id={id} autoComplete="username" autoCapitalize="none" aria-describedby={describedBy} invalid={invalid} {...register('identifier')} />}
          </Field>
          <Field label={en.login.passwordLabel} error={errors.password && en.login.passwordRequired}>
            {({ id, describedBy, invalid }) => <Input id={id} type="password" autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} {...register('password')} />}
          </Field>
          <Button type="submit" block busy={mutation.isPending}>{en.login.submit}</Button>
        </form>
      </div>
    </div>
  );
};
export default LoginPage;
