import { query } from '../db/pool.js';
import { hmac, randomDigits, safeEqual } from '../lib/crypto.js';
import { HttpError, badRequest } from '../lib/errors.js';
import { sendSms } from '../services/sms.js';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

/** Creates and sends a 6-digit login code. Returns the code so callers can expose it in development. */
export const issueOtp = async (phone: string) => {
  const { rows } = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 hour'`,
    [phone]
  );
  if (rows[0].count >= MAX_CODES_PER_HOUR) {
    throw new HttpError(429, 'Too many codes requested for this number. Please wait an hour and try again.', 'otp_rate_limited');
  }

  const code = randomDigits(6);
  await query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [phone, hmac(`${phone}:${code}`), OTP_TTL_MINUTES]
  );
  await sendSms(phone, `Your Nursery Link code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Do not share it with anyone.`);
  return code;
};

/** Checks the latest unused code for the phone. Throws on a wrong or expired code. */
export const verifyOtp = async (phone: string, code: string) => {
  const { rows } = await query<{ id: string; code_hash: string; attempts: number; expired: boolean }>(
    `SELECT id, code_hash, attempts, expires_at < now() AS expired FROM otp_codes
     WHERE phone = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  const otp = rows[0];
  if (!otp || otp.expired) throw badRequest('That code has expired. Request a new one.', 'otp_expired');
  if (otp.attempts >= MAX_ATTEMPTS) throw badRequest('Too many wrong attempts. Request a new code.', 'otp_locked');

  if (!safeEqual(otp.code_hash, hmac(`${phone}:${code}`))) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    throw badRequest('That code is not correct.', 'otp_invalid');
  }
  await query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otp.id]);
};
