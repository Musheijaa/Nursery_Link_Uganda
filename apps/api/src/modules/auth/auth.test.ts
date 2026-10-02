import { RecordingQueue } from '../../jobs/queue.js';
import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { AuthTokens, PublicUser } from '@nurserylink/shared';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { signAccessToken } from '../../lib/tokens.js';
import { prepareTestDatabase, TEST_ADMIN } from '../../../test/db.js';
import { errorOf } from '../../../test/http.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const config = testConfig(inject('databaseUrl'));
const providers = mockProviders();
const app = createApp({ config, pool, logger: pino({ level: 'silent' }), providers, queue: new RecordingQueue() });

beforeAll(() => prepareTestDatabase(pool));
afterAll(() => pool.end());

// ── Helpers ────────────────────────────────────────────────

let phoneCounter = 0;
/** A fresh phone number for each test, in local format (the API normalises it). */
const newPhone = () => `07720${String(10000 + ++phoneCounter).slice(-5)}0`.slice(0, 10);
const e164 = (local: string) => `+256${local.slice(1)}`;

const lastCode = (phone: string): string => {
  const message = providers.sms.lastTo(e164(phone))?.message ?? '';
  const code = /\b(\d{6})\b/.exec(message)?.[1];
  if (!code) throw new Error(`No code sent to ${phone}`);
  return code;
};

/** Moves this number's codes back in time, to get past the one-minute resend cooldown. */
const skipCooldown = (phone: string) =>
  pool.query(`UPDATE otp_codes SET created_at = created_at - interval '2 minutes' WHERE phone = $1`, [e164(phone)]);

const tokensOf = (res: request.Response) => (res.body as { data: AuthTokens }).data;
const userOf = (res: request.Response) => (res.body as { data: PublicUser }).data;

const refreshCookie = (res: request.Response): string | undefined => {
  const raw = res.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(raw) ? (raw as string[]) : [];
  return cookies.find(c => c.startsWith('nl_refresh='))?.split(';')[0];
};

const registerAndVerify = async (phone = newPhone(), password = 'correct-horse-battery', email?: string) => {
  await request(app).post('/api/v1/auth/register').send({ full_name: 'Nakato Sarah', phone, password, ...(email ? { email } : {}) }).expect(201);
  const res = await request(app).post('/api/v1/auth/verify').send({ phone, code: lastCode(phone) }).expect(200);
  return { phone, password, res, tokens: tokensOf(res), cookie: refreshCookie(res) };
};

// ── Registration and verification ──────────────────────────

describe('registration and phone verification', () => {
  it('registers an unverified buyer and sends a 6-digit SMS code', async () => {
    const phone = newPhone();
    const res = await request(app).post('/api/v1/auth/register')
      .send({ full_name: '  Okello Denis ', phone: phone.replace(/^0/, '+256'), password: 'long-enough-pass', email: 'Denis@Example.ORG' })
      .expect(201);
    const { user } = (res.body as { data: { user: PublicUser } }).data;
    expect(user).toMatchObject({ full_name: 'Okello Denis', phone: e164(phone), email: 'denis@example.org', role: 'buyer', phone_verified: false });
    expect(res.body).not.toHaveProperty('data.user.password_hash');
    expect(lastCode(phone)).toMatch(/^\d{6}$/);
  });

  it('will not sign in until the phone is verified', async () => {
    const phone = newPhone();
    await request(app).post('/api/v1/auth/register').send({ full_name: 'Apio Harriet', phone, password: 'long-enough-pass' }).expect(201);
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: phone, password: 'long-enough-pass' }).expect(403);
    expect(errorOf(res).code).toBe('phone_not_verified');
  });

  it('verifies with the right code, signs in and sets an httpOnly refresh cookie', async () => {
    const { tokens, res, phone } = await registerAndVerify();
    expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 900, user: { phone: e164(phone), phone_verified: true } });
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find(c => c.startsWith('nl_refresh='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(JSON.stringify(res.body)).not.toContain('nl_refresh');
  });

  it('rejects wrong codes, locks after 5 attempts, and never accepts a code twice', async () => {
    const phone = newPhone();
    await request(app).post('/api/v1/auth/register').send({ full_name: 'Ssali Moses', phone, password: 'long-enough-pass' }).expect(201);
    const code = lastCode(phone);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/v1/auth/verify').send({ phone, code: wrong }).expect(400);
      expect(errorOf(res).message).toMatch(/not correct/);
    }
    const locked = await request(app).post('/api/v1/auth/verify').send({ phone, code }).expect(400);
    expect(errorOf(locked).message).toMatch(/Too many wrong attempts/);

    // A new code works once, then is spent
    await skipCooldown(phone);
    await request(app).post('/api/v1/auth/verify/request').send({ phone }).expect(202);
    const fresh = lastCode(phone);
    await request(app).post('/api/v1/auth/verify').send({ phone, code: fresh }).expect(200);
    await request(app).post('/api/v1/auth/verify').send({ phone, code: fresh }).expect(400);
  });

  it('rejects expired codes', async () => {
    const phone = newPhone();
    await request(app).post('/api/v1/auth/register').send({ full_name: 'Aber Grace', phone, password: 'long-enough-pass' }).expect(201);
    await pool.query(`UPDATE otp_codes SET expires_at = now() - interval '1 second' WHERE phone = $1`, [e164(phone)]);
    const res = await request(app).post('/api/v1/auth/verify').send({ phone, code: lastCode(phone) }).expect(400);
    expect(errorOf(res).message).toMatch(/expired/);
  });

  it('enforces the resend cooldown and the hourly cap per number', async () => {
    const phone = newPhone();
    await request(app).post('/api/v1/auth/register').send({ full_name: 'Drani Jimmy', phone, password: 'long-enough-pass' }).expect(201);
    const tooSoon = await request(app).post('/api/v1/auth/verify/request').send({ phone }).expect(429);
    expect(errorOf(tooSoon).message).toMatch(/wait a minute/);

    for (let sent = 1; sent < 5; sent++) {
      await skipCooldown(phone);
      await request(app).post('/api/v1/auth/verify/request').send({ phone }).expect(202);
    }
    await skipCooldown(phone);
    const capped = await request(app).post('/api/v1/auth/verify/request').send({ phone }).expect(429);
    expect(errorOf(capped).message).toMatch(/Too many codes/);
  });

  it('refuses a verified number, lets an unverified one be re-claimed, and keeps emails unique', async () => {
    const { phone } = await registerAndVerify(undefined, undefined, 'taken@example.org');
    const dup = await request(app).post('/api/v1/auth/register').send({ full_name: 'Another Person', phone, password: 'long-enough-pass' }).expect(409);
    expect(errorOf(dup).code).toBe('conflict');

    const other = newPhone();
    await request(app).post('/api/v1/auth/register').send({ full_name: 'Y Y', phone: other, password: 'long-enough-pass', email: 'TAKEN@example.org' }).expect(409);

    // Unverified numbers can be registered again by whoever holds the SIM
    await request(app).post('/api/v1/auth/register').send({ full_name: 'First Try', phone: other, password: 'long-enough-pass' }).expect(201);
    await skipCooldown(other);
    const again = await request(app).post('/api/v1/auth/register').send({ full_name: 'Second Try', phone: other, password: 'another-password' }).expect(201);
    expect((again.body as { data: { user: PublicUser } }).data.user.full_name).toBe('Second Try');
  });

  it('validates input with field-level messages', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ full_name: 'A', phone: '12345', password: 'short' }).expect(400);
    const paths = (errorOf(res).details as { path: string }[]).map(d => d.path).sort();
    expect(paths).toEqual(['full_name', 'password', 'phone']);
  });

  it('does not reveal whether a number is registered when resending codes', async () => {
    const res = await request(app).post('/api/v1/auth/verify/request').send({ phone: '0772999999' }).expect(202);
    expect(providers.sms.lastTo('+256772999999')).toBeUndefined();
    expect(JSON.stringify(res.body)).toMatch(/If this number/);
  });
});

// ── Sign in, refresh, logout ───────────────────────────────

describe('sessions', () => {
  it('signs in with a phone number in any format, or with an email in any case', async () => {
    const { phone, password } = await registerAndVerify(undefined, undefined, 'amina@example.org');
    for (const identifier of [phone, e164(phone), `256${phone.slice(1)}`, 'AMINA@example.org']) {
      await request(app).post('/api/v1/auth/login').send({ identifier, password }).expect(200);
    }
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const { phone } = await registerAndVerify();
    const wrong = await request(app).post('/api/v1/auth/login').send({ identifier: phone, password: 'not-the-password' }).expect(401);
    const unknown = await request(app).post('/api/v1/auth/login').send({ identifier: '0772888888', password: 'not-the-password' }).expect(401);
    expect(errorOf(wrong)).toEqual(errorOf(unknown));
  });

  it('returns the signed-in user from /me and rejects missing or bad tokens', async () => {
    const { tokens } = await registerAndVerify();
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokens.access_token}`).expect(200);
    expect(userOf(me).id).toBe(tokens.user.id);

    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokens.access_token}x`).expect(401);
    await request(app).get('/api/v1/auth/me').set('Authorization', tokens.access_token).expect(401);
  });

  it('rotates the refresh token, and a replayed token ends every session', async () => {
    const { cookie } = await registerAndVerify();
    if (!cookie) throw new Error('no cookie');

    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    const rotated = refreshCookie(first);
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(cookie);
    expect(tokensOf(first).access_token).toBeTruthy();

    // Replaying the old token is treated as theft: it fails and revokes the new one too
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', rotated ?? '').expect(401);
  });

  it('logs out by revoking the refresh token', async () => {
    const { cookie } = await registerAndVerify();
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie ?? '').expect(204);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie ?? '').expect(401);
    await request(app).post('/api/v1/auth/refresh').expect(401);
  });

  it('rejects expired refresh tokens', async () => {
    const { cookie, tokens } = await registerAndVerify();
    await pool.query(`UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1`, [tokens.user.id]);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie ?? '').expect(401);
  });
});

// ── Password reset ─────────────────────────────────────────

describe('password reset', () => {
  it('resets with an SMS code and signs out every session', async () => {
    const { phone, password, cookie } = await registerAndVerify();
    await request(app).post('/api/v1/auth/password/forgot').send({ phone }).expect(202);
    const code = lastCode(phone);
    await request(app).post('/api/v1/auth/password/reset').send({ phone, code, new_password: 'brand-new-password' }).expect(200);

    await request(app).post('/api/v1/auth/login').send({ identifier: phone, password }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ identifier: phone, password: 'brand-new-password' }).expect(200);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie ?? '').expect(401);
    // The code is spent
    await request(app).post('/api/v1/auth/password/reset').send({ phone, code, new_password: 'third-password-here' }).expect(400);
  });

  it('resets with an emailed link that works only once', async () => {
    const { phone } = await registerAndVerify(undefined, undefined, 'link@example.org');
    await request(app).post('/api/v1/auth/password/forgot').send({ email: 'Link@Example.org' }).expect(202);
    const email = providers.email.lastTo('link@example.org');
    const token = /token=([\w.-]+)/.exec(email?.text ?? '')?.[1];
    expect(email?.text).toContain('http://localhost:5173/reset-password?token=');
    if (!token) throw new Error('no reset link');

    await request(app).post('/api/v1/auth/password/reset').send({ token, new_password: 'via-email-link-1' }).expect(200);
    await request(app).post('/api/v1/auth/login').send({ identifier: phone, password: 'via-email-link-1' }).expect(200);
    const reused = await request(app).post('/api/v1/auth/password/reset').send({ token, new_password: 'via-email-link-2' }).expect(400);
    expect(errorOf(reused).message).toMatch(/invalid or has expired/);
  });

  it('gives the same answer for unknown accounts and sends nothing', async () => {
    const before = providers.sms.outbox.length + providers.email.outbox.length;
    await request(app).post('/api/v1/auth/password/forgot').send({ phone: '0772777777' }).expect(202);
    await request(app).post('/api/v1/auth/password/forgot').send({ email: 'nobody@example.org' }).expect(202);
    expect(providers.sms.outbox.length + providers.email.outbox.length).toBe(before);
  });

  it('rejects a tampered reset token', async () => {
    await request(app).post('/api/v1/auth/password/reset').send({ token: 'eyJhbGciOiJIUzI1NiJ9.e30.tampered-signature', new_password: 'whatever-pass' }).expect(400);
  });
});

// ── Role-based access ──────────────────────────────────────

describe('RBAC on /admin', () => {
  it('returns 401 for visitors, 403 for buyers and passes admins through', async () => {
    await request(app).get('/api/v1/admin/anything').expect(401);

    const { tokens } = await registerAndVerify();
    const buyer = await request(app).get('/api/v1/admin/anything').set('Authorization', `Bearer ${tokens.access_token}`).expect(403);
    expect(errorOf(buyer).code).toBe('forbidden');

    const login = await request(app).post('/api/v1/auth/login').send({ identifier: TEST_ADMIN.email, password: TEST_ADMIN.password }).expect(200);
    expect(tokensOf(login).user.role).toBe('admin');
    // No admin endpoints exist yet in Phase 2, so an admin reaches the 404 behind the guard
    await request(app).get('/api/v1/admin/anything').set('Authorization', `Bearer ${tokensOf(login).access_token}`).expect(404);
  });

  it('does not trust a role the server did not sign', async () => {
    const forged = await signAccessToken('attacker-secret-that-is-32-characters-long', { sub: '00000000-0000-0000-0000-000000000000', role: 'admin' });
    await request(app).get('/api/v1/admin/anything').set('Authorization', `Bearer ${forged}`).expect(401);
  });
});

describe('separate sessions for the admin console and the public site', () => {
  const cookieNamed = (res: request.Response, name: string) =>
    ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).find(c => c.startsWith(`${name}=`))?.split(';')[0];

  it('keeps the admin console in its own cookie, so signing in there leaves the public site alone', async () => {
    const admin = await request(app).post('/api/v1/auth/login').set('X-Client', 'admin')
      .send({ identifier: TEST_ADMIN.email, password: TEST_ADMIN.password }).expect(200);
    const adminCookie = cookieNamed(admin, 'nl_admin_refresh');
    expect(adminCookie).toBeDefined();
    expect(cookieNamed(admin, 'nl_refresh')).toBeUndefined();

    // The admin console refreshes with its cookie...
    await request(app).post('/api/v1/auth/refresh').set('X-Client', 'admin').set('Cookie', adminCookie ?? '').expect(200);
    // ...but the public site never sees it: the admin isn't signed in there
    await request(app).post('/api/v1/auth/refresh').set('Cookie', adminCookie ?? '').expect(401);
  });

  it("keeps a buyer's public-site session out of the admin console", async () => {
    const phone = newPhone();
    await registerAndVerify(phone);
    const web = await request(app).post('/api/v1/auth/login').send({ identifier: phone, password: 'correct-horse-battery' }).expect(200);
    const webCookie = cookieNamed(web, 'nl_refresh');
    expect(webCookie).toBeDefined();
    await request(app).post('/api/v1/auth/refresh').set('X-Client', 'admin').set('Cookie', webCookie ?? '').expect(401);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', webCookie ?? '').expect(200);
  });
});
