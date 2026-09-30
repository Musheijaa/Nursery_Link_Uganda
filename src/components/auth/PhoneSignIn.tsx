import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api, errorMessage } from '../../api/client';
import { queryKeys } from '../../api/hooks';
import { User } from '../../types';
import { formatPhone, normaliseUgandanMobile } from '../../utils/phone';
import { Button, Field, inputClass } from '../ui';

interface PhoneSignInProps {
  intro?: string;
  askName?: boolean;
  onSignedIn?: (user: User) => void;
  onUsePassword?: () => void;
}

/** Two-step sign-in with an SMS code: enter phone, then the 6-digit code. */
export const PhoneSignIn: React.FC<PhoneSignInProps> = ({ intro, askName = false, onSignedIn, onUsePassword }) => {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const normalised = normaliseUgandanMobile(phone);

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!normalised) {
      setError('Enter a Ugandan mobile number, e.g. 0772 123 456');
      return;
    }
    if (askName && name.trim().length < 2) {
      setError('Enter your name');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ sent: boolean; devCode?: string }>('/auth/otp/request', { phone: normalised });
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.post<{ user: User }>('/auth/otp/verify', {
        phone: normalised,
        code: code.trim(),
        ...(askName && name.trim() ? { name: name.trim() } : {}),
      });
      queryClient.setQueryData(queryKeys.me, user);
      await queryClient.invalidateQueries({ predicate: q => q.queryKey[0] !== 'me' });
      onSignedIn?.(user);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'use_password') setNeedsPassword(true);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="space-y-4" noValidate>
        <p className="text-sm text-stone-700">
          We sent a 6-digit code by SMS to <strong>{formatPhone(normalised!)}</strong>.
        </p>
        {devCode && (
          <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Development mode: no SMS is sent. Your code is <strong className="font-mono">{devCode}</strong>.
          </p>
        )}
        <Field label="Code" error={error}>
          {id => (
            <input
              id={id}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className={`${inputClass} font-mono tracking-[0.3em]`}
              autoFocus
            />
          )}
        </Field>
        {needsPassword && onUsePassword && (
          <Button variant="secondary" className="w-full" onClick={onUsePassword}>Sign in with password</Button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setStep('phone'); setCode(''); setError(null); }} className="flex-1">
            Change number
          </Button>
          <Button type="submit" disabled={code.length !== 6 || busy} className="flex-1">
            {busy ? 'Checking…' : 'Continue'}
          </Button>
        </div>
        <button type="button" onClick={() => requestCode()} disabled={busy} className="text-sm font-medium text-brand-700 hover:underline">
          Send a new code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4" noValidate>
      {intro && <p className="text-sm text-stone-700">{intro}</p>}
      {askName && (
        <Field label="Your name">
          {id => <input id={id} value={name} onChange={e => setName(e.target.value)} className={inputClass} autoComplete="name" />}
        </Field>
      )}
      <Field label="Phone number" error={error}>
        {id => (
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="07XX XXX XXX"
            className={inputClass}
          />
        )}
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send code by SMS'}</Button>
    </form>
  );
};
