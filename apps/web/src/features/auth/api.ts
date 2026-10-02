import { unwrap } from '@nurserylink/api-client';
import type { z } from 'zod';
import type { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyPhoneSchema } from '@nurserylink/shared';
import { api, session } from '../../lib/api';

// Values after the shared schemas' transforms (e.g. phone numbers already in +256 form)
export type RegisterValues = z.output<typeof registerSchema>;
export type VerifyValues = z.output<typeof verifyPhoneSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type ForgotValues = z.output<typeof forgotPasswordSchema>;
export type ResetValues = z.output<typeof resetPasswordSchema>;

/** Creates the account. While phone verification is switched off, it is confirmed and signed in at once. */
export const register = async (body: RegisterValues) => {
  const { data } = await unwrap(api.POST('/auth/register', { body }));
  if (data.tokens) session.signIn(data.tokens);
  return data;
};

export const requestCode = async (phone: string) => (await unwrap(api.POST('/auth/verify/request', { body: { phone } }))).data;

/** Confirms the phone and signs in. */
export const verify = async (body: VerifyValues) => {
  const { data } = await unwrap(api.POST('/auth/verify', { body }));
  session.signIn(data);
  return data.user;
};

export const login = async (body: LoginValues) => {
  const { data } = await unwrap(api.POST('/auth/login', { body }));
  session.signIn(data);
  return data.user;
};

export const forgotPassword = async (body: ForgotValues) => (await unwrap(api.POST('/auth/password/forgot', { body }))).data;

export const resetPassword = async (body: ResetValues) => (await unwrap(api.POST('/auth/password/reset', { body }))).data;
