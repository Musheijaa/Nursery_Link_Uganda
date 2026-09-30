import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config, exposeDevCodes } from '../config.js';
import { query, withTransaction } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { HttpError, badRequest, conflict } from '../lib/errors.js';
import { detectNetwork, phoneSchema } from '../lib/phone.js';
import { endSession, requireRole, requireUser, startSession } from '../auth/sessions.js';
import { issueOtp, verifyOtp } from '../auth/otp.js';
import { sendSms } from '../services/sms.js';

export const authRouter = Router();

const limiter = (limit: number, minutes: number) => rateLimit({
  windowMs: minutes * 60 * 1000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  handler: (_req, _res, next) => next(new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.', 'rate_limited')),
});

const userDto = (u: { id: string; phone: string; name: string | null; role: string }) => ({ id: u.id, phone: u.phone, name: u.name, role: u.role });

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? userDto(req.user) : null });
});

authRouter.post('/otp/request', limiter(10, 15), async (req, res) => {
  const { phone } = z.object({ phone: phoneSchema }).parse(req.body);
  const code = await issueOtp(phone);
  res.json({ sent: true, ...(exposeDevCodes ? { devCode: code } : {}) });
});

authRouter.post('/otp/verify', limiter(20, 15), async (req, res) => {
  const body = z.object({
    phone: phoneSchema,
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    name: z.string().trim().min(2).max(80).optional(),
  }).parse(req.body);

  const { rows: [existing] } = await query<{ id: string; role: string }>('SELECT id, role FROM users WHERE phone = $1', [body.phone]);
  if (existing && existing.role !== 'buyer') {
    // Accounts that can move money or manage stock must use their password
    throw badRequest('This number belongs to a nursery or admin account. Sign in with your password.', 'use_password');
  }

  await verifyOtp(body.phone, body.code);

  const { rows: [user] } = await query<{ id: string; phone: string; name: string | null; role: string }>(
    `INSERT INTO users (phone, name) VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name)
     RETURNING id, phone, name, role`,
    [body.phone, body.name ?? null]
  );
  await startSession(res, user.id);
  res.json({ user: userDto(user) });
});

authRouter.post('/login', limiter(10, 15), async (req, res) => {
  const body = z.object({ phone: phoneSchema, password: z.string().min(1).max(200) }).parse(req.body);
  const { rows: [user] } = await query<{ id: string; phone: string; name: string | null; role: string; password_hash: string | null }>(
    'SELECT id, phone, name, role, password_hash FROM users WHERE phone = $1',
    [body.phone]
  );
  const valid = user?.password_hash ? await verifyPassword(body.password, user.password_hash) : false;
  if (!user || !valid) throw new HttpError(401, 'Phone number or password is not correct', 'invalid_credentials');

  await startSession(res, user.id);
  res.json({ user: userDto(user) });
});

authRouter.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.json({ ok: true });
});

const DELIVERY_METHODS = ['Collect from nursery', 'Boda boda', 'Truck'] as const;
const REGISTRATIONS = ['NFA registered', 'MAAIF certified', 'District registered', 'Community group'] as const;

export const nurseryProfileSchema = z.object({
  name: z.string().trim().min(3).max(100),
  operatorName: z.string().trim().min(2).max(80),
  district: z.string().trim().min(1).max(60),
  subCounty: z.string().trim().min(2).max(80),
  village: z.string().trim().min(2).max(80),
  coordinates: z.tuple([z.number().min(-1.6).max(4.3), z.number().min(29.5).max(35.1)]).optional(),
  registration: z.enum(REGISTRATIONS),
  registrationNumber: z.string().trim().min(3).max(40),
  established: z.number().int().min(1950).max(new Date().getFullYear()),
  description: z.string().trim().min(20).max(600),
  openingHours: z.string().trim().min(3).max(80),
  deliveryMethods: z.array(z.enum(DELIVERY_METHODS)).min(1),
  payoutPhone: phoneSchema.optional(),
});

const slugify = (value: string) =>
  value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'nursery';

/**
 * Registers a nursery for the signed-in (phone-verified) user and turns their account into a
 * nursery owner account with a password. The listing stays hidden until an admin approves it.
 */
authRouter.post('/register-nursery', limiter(5, 60), async (req, res) => {
  const user = requireUser(req);
  if (user.role !== 'buyer') throw conflict('This account already manages a nursery');
  const body = nurseryProfileSchema.extend({
    password: z.string().min(8, 'Use at least 8 characters').max(200),
  }).parse(req.body);

  const payoutPhone = body.payoutPhone ?? user.phone;
  const payoutNetwork = detectNetwork(payoutPhone);
  if (!payoutNetwork) throw badRequest('The payout number must be an MTN or Airtel number');

  const nursery = await withTransaction(async db => {
    const { rows: [district] } = await db.query<{ id: number }>('SELECT id FROM districts WHERE name = $1', [body.district]);
    if (!district) throw badRequest('Choose a district from the list');

    const baseSlug = slugify(body.name);
    const { rows: taken } = await db.query<{ slug: string }>(`SELECT slug FROM nurseries WHERE slug LIKE $1 || '%'`, [baseSlug]);
    let slug = baseSlug;
    for (let i = 2; taken.some(t => t.slug === slug); i++) slug = `${baseSlug}-${i}`;

    await db.query(`UPDATE users SET role = 'nursery_owner', name = $2, password_hash = $3 WHERE id = $1`,
      [user.id, body.operatorName, await hashPassword(body.password)]);

    const { rows: [created] } = await db.query<{ id: string; slug: string; status: string }>(
      `INSERT INTO nurseries (slug, owner_id, name, operator_name, phone, payout_phone, payout_network, district_id, sub_county,
                              village, location, registration_type, registration_number, established_year, description,
                              opening_hours, delivery_methods)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              COALESCE(ST_SetSRID(ST_MakePoint($12, $11), 4326)::geography, d.location),
              $13, $14, $15, $16, $17, $18
       FROM districts d WHERE d.id = $8
       RETURNING id, slug, status`,
      [slug, user.id, body.name, body.operatorName, user.phone, payoutPhone, payoutNetwork, district.id, body.subCounty,
        body.village, body.coordinates?.[0] ?? null, body.coordinates?.[1] ?? null, body.registration, body.registrationNumber,
        body.established, body.description, body.openingHours, body.deliveryMethods]
    );
    return created;
  });

  if (config.ADMIN_PHONE) {
    const { rows: [admin] } = await query<{ phone: string }>(`SELECT phone FROM users WHERE role = 'admin' LIMIT 1`);
    if (admin) await sendSms(admin.phone, `New nursery listing to review: ${body.name} (${body.district}).`);
  }

  res.status(201).json({ nursery, user: { ...userDto(user), role: 'nursery_owner', name: body.operatorName } });
});

/** Lets a signed-in nursery owner or admin change their password. */
authRouter.post('/password', limiter(10, 15), async (req, res) => {
  const user = requireRole(req, 'nursery_owner', 'admin');
  const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) }).parse(req.body);
  const { rows: [row] } = await query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await verifyPassword(body.currentPassword, row.password_hash))) throw badRequest('Current password is not correct');
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, await hashPassword(body.newPassword)]);
  // Sign out other devices
  await query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
  await startSession(res, user.id);
  res.json({ ok: true });
});

/** Forgotten password: the owner requests an SMS code with /otp/request, then sets a new password here. */
authRouter.post('/password/reset', limiter(10, 15), async (req, res) => {
  const body = z.object({
    phone: phoneSchema,
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(200),
  }).parse(req.body);

  const { rows: [user] } = await query<{ id: string; phone: string; name: string | null; role: string }>(
    `SELECT id, phone, name, role FROM users WHERE phone = $1 AND role <> 'buyer'`, [body.phone]);
  await verifyOtp(body.phone, body.code);
  if (!user) throw badRequest('There is no nursery account for this number');

  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, await hashPassword(body.newPassword)]);
  await query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
  await startSession(res, user.id);
  res.json({ user: userDto(user) });
});
