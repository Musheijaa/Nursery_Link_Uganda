import request from 'supertest';
import type { Express } from 'express';
import type { AuthTokens } from '@nurserylink/shared';
import type { MockSms } from '../src/providers/sms/mockSms.js';
import { TEST_ADMIN } from './db.js';

/** Access token for the seeded administrator. */
export const adminToken = async (app: Express): Promise<string> => {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier: TEST_ADMIN.email, password: TEST_ADMIN.password }).expect(200);
  return (res.body as { data: AuthTokens }).data.access_token;
};

let buyerCounter = 0;

/** Registers and verifies a fresh buyer (reading the SMS code from the mock outbox) and returns their session. */
export const newBuyer = async (app: Express, sms: MockSms): Promise<{ token: string; userId: string; phone: string }> => {
  buyerCounter += 1;
  const suffix = String((Date.now() % 100000) * 10 + (buyerCounter % 10)).padStart(6, '0').slice(-6);
  const phone = `0751${suffix}`;
  await request(app).post('/api/v1/auth/register').send({ full_name: 'Test Buyer', phone, password: 'buyer-password-1' }).expect(201);
  const e164 = `+256${phone.slice(1)}`;
  const code = /\b(\d{6})\b/.exec(sms.lastTo(e164)?.message ?? '')?.[1];
  if (!code) throw new Error(`No code sent to ${phone}`);
  const res = await request(app).post('/api/v1/auth/verify').send({ phone, code }).expect(200);
  const { access_token, user } = (res.body as { data: AuthTokens }).data;
  return { token: access_token, userId: user.id, phone: e164 };
};

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
