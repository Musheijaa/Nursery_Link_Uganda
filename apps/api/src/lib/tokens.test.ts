import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { UnauthorizedError, ValidationError } from './errors.js';
import { passwordFingerprint, signAccessToken, signResetToken, verifyAccessToken, verifyResetToken } from './tokens.js';

const SECRET = 'unit-test-secret-that-is-at-least-32-characters';

describe('access tokens', () => {
  it('round-trips the user id and role', async () => {
    const token = await signAccessToken(SECRET, { sub: 'user-1', role: 'admin' });
    await expect(verifyAccessToken(SECRET, token)).resolves.toEqual({ sub: 'user-1', role: 'admin' });
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signAccessToken('another-secret-that-is-also-32-characters-long', { sub: 'u', role: 'buyer' });
    await expect(verifyAccessToken(SECRET, token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects expired tokens and tokens of the wrong type', async () => {
    const key = new TextEncoder().encode(SECRET);
    const expired = await new SignJWT({ role: 'buyer', typ: 'access' }).setProtectedHeader({ alg: 'HS256' })
      .setSubject('u').setIssuer('nurserylink-api').setAudience('nurserylink').setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(key);
    await expect(verifyAccessToken(SECRET, expired)).rejects.toThrow(/expired/);

    const reset = await signResetToken(SECRET, 'u', 'hash');
    await expect(verifyAccessToken(SECRET, reset)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects the "none" algorithm', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u', role: 'admin', typ: 'access', iss: 'nurserylink-api', aud: 'nurserylink' })).toString('base64url');
    await expect(verifyAccessToken(SECRET, `${header}.${payload}.`)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('reset tokens', () => {
  it('carries a fingerprint of the password hash', async () => {
    const token = await signResetToken(SECRET, 'user-1', 'argon-hash-1');
    const claims = await verifyResetToken(SECRET, token);
    expect(claims).toEqual({ userId: 'user-1', passwordFingerprint: passwordFingerprint('argon-hash-1') });
    expect(claims.passwordFingerprint).not.toBe(passwordFingerprint('argon-hash-2'));
  });

  it('refuses access tokens used as reset tokens', async () => {
    const access = await signAccessToken(SECRET, { sub: 'u', role: 'buyer' });
    await expect(verifyResetToken(SECRET, access)).rejects.toBeInstanceOf(ValidationError);
  });
});
