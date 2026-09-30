import { z } from 'zod';

export type PaymentNetwork = 'MTN MoMo' | 'Airtel Money';

/** Normalises Ugandan mobile numbers (07…, 2567…, +256 7…) to 07XXXXXXXX, or null if invalid. */
export const normaliseUgandanMobile = (input: string): string | null => {
  const digits = input.replace(/[^\d]/g, '');
  const local = digits.startsWith('256') ? `0${digits.slice(3)}` : digits;
  return /^07\d{8}$/.test(local) ? local : null;
};

const MTN_PREFIXES = ['076', '077', '078'];
const AIRTEL_PREFIXES = ['070', '074', '075'];

export const detectNetwork = (phone: string): PaymentNetwork | null => {
  const prefix = phone.slice(0, 3);
  if (MTN_PREFIXES.includes(prefix)) return 'MTN MoMo';
  if (AIRTEL_PREFIXES.includes(prefix)) return 'Airtel Money';
  return null;
};

/** 0772123456 -> 256772123456 */
export const toInternational = (phone: string) => `256${phone.slice(1)}`;

export const phoneSchema = z.string().transform((value, ctx) => {
  const normalised = normaliseUgandanMobile(value);
  if (!normalised) {
    ctx.addIssue({ code: 'custom', message: 'Enter a Ugandan mobile number, e.g. 0772 123 456' });
    return z.NEVER;
  }
  return normalised;
});
