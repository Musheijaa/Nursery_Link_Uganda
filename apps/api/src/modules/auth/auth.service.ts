import type { Logger } from 'pino';
import type { z } from 'zod';
import {
  toE164UgandaMobile,
  type AuthTokens,
  type OtpPurpose,
  type PublicUser,
  type forgotPasswordSchema,
  type registerSchema,
  type resetPasswordSchema,
} from '@nurserylink/shared';
import type { Config } from '../../config.js';
import type { Database, DbOrTx } from '../../db/client.js';
import type { Providers } from '../../providers/index.js';
import { hmacSha256, randomDigits, randomToken, safeEqual, sha256 } from '../../lib/crypto.js';
import { ConflictError, NotFoundError, PhoneNotVerifiedError, RateLimitedError, UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  passwordFingerprint,
  signAccessToken,
  signResetToken,
  verifyResetToken,
} from '../../lib/tokens.js';
import * as repo from './auth.repo.js';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

type RegisterData = z.output<typeof registerSchema>;
type ForgotData = z.output<typeof forgotPasswordSchema>;
type ResetData = z.output<typeof resetPasswordSchema>;

/** Tokens for a new session. The refresh token goes in an httpOnly cookie, never in the body. */
export interface Session {
  tokens: AuthTokens;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthDeps {
  db: Database;
  config: Config;
  providers: Providers;
  logger: Logger;
}

// A real argon2id hash of a random string, so unknown accounts take as long to reject as wrong passwords
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(randomToken()));

export const toPublicUser = (u: repo.UserRow): PublicUser => ({
  id: u.id,
  full_name: u.fullName,
  phone: u.phone,
  email: u.email,
  role: u.role,
  phone_verified: u.phoneVerified,
  created_at: u.createdAt.toISOString(),
});

export class AuthService {
  constructor(private readonly deps: AuthDeps) {}

  // ── Registration and phone verification ──────────────────

  /**
   * Creates the account and texts a code, or, while phone verification is switched off
   * (PHONE_VERIFICATION=off), confirms it at once and returns a session.
   */
  async register(input: RegisterData): Promise<{ user: PublicUser; session: Session | null }> {
    const { db } = this.deps;
    const passwordHash = await hashPassword(input.password);
    const email = input.email ?? null;

    const user = await db.transaction(async tx => {
      const existing = await repo.findUserByPhone(tx, input.phone);
      if (existing?.phoneVerified) {
        throw new ConflictError('An account with this phone number already exists. Sign in or reset your password.');
      }
      if (email) {
        const emailOwner = await repo.findUserByEmail(tx, email);
        if (emailOwner && emailOwner.id !== existing?.id) throw new ConflictError('An account with this email address already exists.');
      }
      // A number that was registered but never verified can be claimed again by whoever holds the SIM
      return existing
        ? repo.replaceUnverifiedUser(tx, existing.id, { fullName: input.full_name, email, passwordHash })
        : repo.insertUser(tx, { fullName: input.full_name, phone: input.phone, email, passwordHash });
    });

    if (this.deps.config.PHONE_VERIFICATION === 'off') {
      const confirmed = await repo.markPhoneVerified(db, user.id);
      return { user: toPublicUser(confirmed), session: await this.startSession(confirmed) };
    }
    await this.issueOtp(user.phone, 'verify');
    return { user: toPublicUser(user), session: null };
  }

  /** Resends a verification code. Silent for unknown or already-verified numbers, so it can't be used to probe accounts. */
  async requestVerification(phone: string): Promise<void> {
    const user = await repo.findUserByPhone(this.deps.db, phone);
    if (user && !user.phoneVerified) await this.issueOtp(phone, 'verify');
  }

  async verifyPhone(phone: string, code: string): Promise<Session> {
    await this.checkOtp(phone, 'verify', code);
    const user = await repo.findUserByPhone(this.deps.db, phone);
    if (!user) throw new NotFoundError('Account not found');
    const verified = user.phoneVerified ? user : await repo.markPhoneVerified(this.deps.db, user.id);
    return this.startSession(verified);
  }

  // ── Sign in and sessions ─────────────────────────────────

  async login(identifier: string, password: string): Promise<Session> {
    const user = await this.findByIdentifier(identifier);
    // Always run argon2 so response time does not reveal whether the account exists
    const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
    if (!user || !valid) throw new UnauthorizedError('Phone number, email or password is not correct');
    if (!user.phoneVerified && this.deps.config.PHONE_VERIFICATION === 'required') throw new PhoneNotVerifiedError();
    return this.startSession(user);
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one issued.
   * Presenting an already-revoked token means it was stolen or replayed, so every session
   * for that user is ended.
   */
  async refresh(rawToken: string): Promise<Session> {
    const { db } = this.deps;
    const outcome = await db.transaction(async tx => {
      const row = await repo.findRefreshTokenForUpdate(tx, sha256(rawToken));
      if (!row) return { kind: 'invalid' as const };
      if (row.revokedAt) return { kind: 'reused' as const, userId: row.userId };
      if (row.expiresAt <= new Date()) return { kind: 'invalid' as const };

      await repo.revokeRefreshToken(tx, row.id);
      const user = await repo.findUserById(tx, row.userId);
      if (!user) return { kind: 'invalid' as const };
      return { kind: 'ok' as const, session: await this.startSession(user, tx) };
    });

    if (outcome.kind === 'ok') return outcome.session;
    if (outcome.kind === 'reused') {
      await repo.revokeAllRefreshTokens(db, outcome.userId);
      this.deps.logger.warn({ userId: outcome.userId }, 'Refresh token reuse detected; all sessions revoked');
    }
    throw new UnauthorizedError('Your session has ended. Please sign in again.');
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await repo.revokeRefreshTokenByHash(this.deps.db, sha256(rawToken));
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await repo.findUserById(this.deps.db, userId);
    if (!user) throw new UnauthorizedError('Account not found');
    return toPublicUser(user);
  }

  // ── Password reset ───────────────────────────────────────

  /** A phone number gets an SMS code; an email address gets a link. Silent when no account matches. */
  async forgotPassword(input: ForgotData): Promise<void> {
    if ('phone' in input) {
      const user = await repo.findUserByPhone(this.deps.db, input.phone);
      if (user) await this.issueOtp(user.phone, 'reset');
      return;
    }
    const user = await repo.findUserByEmail(this.deps.db, input.email);
    if (!user?.email) return;
    const token = await signResetToken(this.deps.config.JWT_ACCESS_SECRET, user.id, user.passwordHash);
    const link = new URL('/reset-password', this.deps.config.PUBLIC_WEB_URL);
    link.searchParams.set('token', token);
    await this.deps.providers.email.send({
      to: user.email,
      subject: 'Reset your Nursery Link password',
      text:
        `Hello ${user.fullName},\n\nUse this link to choose a new password. It works once and expires in 30 minutes:\n\n${link.toString()}\n\n` +
        'If you did not ask to reset your password, you can ignore this email.',
    });
  }

  /** Sets a new password and signs the account out everywhere. */
  async resetPassword(input: ResetData): Promise<void> {
    const { db, config } = this.deps;
    let user: repo.UserRow | undefined;

    if ('token' in input) {
      const { userId, passwordFingerprint: fingerprint } = await verifyResetToken(config.JWT_ACCESS_SECRET, input.token);
      user = await repo.findUserById(db, userId);
      // The fingerprint changes with the password, so a used or superseded link stops working
      if (!user || !safeEqual(fingerprint, passwordFingerprint(user.passwordHash))) {
        throw new ValidationError('This reset link is invalid or has expired. Request a new one.');
      }
    } else {
      await this.checkOtp(input.phone, 'reset', input.code);
      user = await repo.findUserByPhone(db, input.phone);
      if (!user) throw new ValidationError('This code is not valid. Request a new one.');
    }

    const passwordHash = await hashPassword(input.new_password);
    const userId = user.id;
    const provedPhone = !('token' in input);
    await db.transaction(async tx => {
      await repo.updatePassword(tx, userId, passwordHash);
      await repo.revokeAllRefreshTokens(tx, userId);
      // An SMS code proves the caller holds the phone, so it also counts as verification
      if (provedPhone) await repo.markPhoneVerified(tx, userId);
    });
  }

  // ── Internals ────────────────────────────────────────────

  private async findByIdentifier(identifier: string): Promise<repo.UserRow | undefined> {
    if (identifier.includes('@')) return repo.findUserByEmail(this.deps.db, identifier.trim().toLowerCase());
    const phone = toE164UgandaMobile(identifier);
    return phone ? repo.findUserByPhone(this.deps.db, phone) : undefined;
  }

  private async startSession(user: repo.UserRow, tx: DbOrTx = this.deps.db): Promise<Session> {
    const refreshToken = randomToken();
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await repo.insertRefreshToken(tx, { userId: user.id, tokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt });
    const accessToken = await signAccessToken(this.deps.config.JWT_ACCESS_SECRET, { sub: user.id, role: user.role });
    return {
      tokens: { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL_SECONDS, user: toPublicUser(user) },
      refreshToken,
      refreshExpiresAt,
    };
  }

  private otpHash(phone: string, purpose: OtpPurpose, code: string) {
    return hmacSha256(this.deps.config.OTP_HMAC_SECRET, `${phone}:${purpose}:${code}`);
  }

  /** Creates and sends a 6-digit code, enforcing the resend cooldown and hourly cap per number. */
  private async issueOtp(phone: string, purpose: OtpPurpose): Promise<void> {
    const { db, providers } = this.deps;
    const stats = await repo.otpStats(db, phone, purpose, new Date(Date.now() - 60 * 60 * 1000));
    if (stats.lastSentAt && Date.now() - stats.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new RateLimitedError('Please wait a minute before asking for another code.');
    }
    if (stats.sentInWindow >= OTP_MAX_PER_HOUR) {
      throw new RateLimitedError('Too many codes requested for this number. Please try again in an hour.');
    }

    const code = randomDigits(6);
    await repo.insertOtp(db, {
      phone,
      purpose,
      codeHash: this.otpHash(phone, purpose, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });
    const what = purpose === 'verify' ? 'verification' : 'password reset';
    await providers.sms.send(phone, `Your Nursery Link ${what} code is ${code}. It expires in ${String(OTP_TTL_MINUTES)} minutes. Do not share it with anyone.`);
  }

  /** Checks and consumes the latest code for this number and purpose. */
  private async checkOtp(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
    const { db } = this.deps;
    const otp = await repo.latestUnusedOtp(db, phone, purpose);
    if (!otp || otp.expiresAt <= new Date()) throw new ValidationError('This code has expired. Request a new one.');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new ValidationError('Too many wrong attempts. Request a new code.');

    if (!safeEqual(otp.codeHash, this.otpHash(phone, purpose, code))) {
      await repo.recordFailedOtpAttempt(db, otp.id);
      throw new ValidationError('That code is not correct.');
    }
    if (!(await repo.consumeOtp(db, otp.id))) throw new ValidationError('This code has already been used. Request a new one.');
  }
}

