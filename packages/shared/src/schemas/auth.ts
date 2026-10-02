import { z } from 'zod';
import { ugandaPhoneSchema } from '../phone.js';

// Request bodies for /api/v1/auth, shared so the frontends validate exactly like the API.

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters');

const emailSchema = z
  .email('Enter a valid email address')
  .max(254)
  .transform(value => value.toLowerCase());

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: ugandaPhoneSchema,
  password: passwordSchema,
  email: emailSchema.optional(),
});
export type RegisterInput = z.input<typeof registerSchema>;

const otpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const requestVerificationSchema = z.object({ phone: ugandaPhoneSchema });

export const verifyPhoneSchema = z.object({ phone: ugandaPhoneSchema, code: otpCodeSchema });
export type VerifyPhoneInput = z.input<typeof verifyPhoneSchema>;

/** Login accepts either a phone number or an email address as the identifier. */
export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

/** Forgotten password: a phone number gets an SMS code, an email address gets a reset link. */
export const forgotPasswordSchema = z.union([
  z.object({ phone: ugandaPhoneSchema }),
  z.object({ email: emailSchema }),
]);
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.union([
  z.object({ phone: ugandaPhoneSchema, code: otpCodeSchema, new_password: passwordSchema }),
  z.object({ token: z.string().min(20).max(2000), new_password: passwordSchema }),
]);
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export interface PublicUser {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: 'buyer' | 'admin';
  phone_verified: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: 'Bearer';
  /** Seconds until the access token expires */
  expires_in: number;
  user: PublicUser;
}
