import { z } from 'zod';

/** Normalises a Ugandan mobile number (07…, 2567…, +256 7…) to E.164 (+2567XXXXXXXX), or null. */
export const toE164UgandaMobile = (input: string): string | null => {
  const digits = input.replace(/\D/g, '');
  const national = digits.startsWith('256') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^7\d{8}$/.test(national) ? `+256${national}` : null;
};

export const E164_UGANDA_MOBILE = /^\+2567\d{8}$/;

export const ugandaPhoneSchema = z.string().transform((value, ctx) => {
  const e164 = toE164UgandaMobile(value);
  if (!e164) {
    ctx.addIssue({ code: 'custom', message: 'Enter a Ugandan mobile number, e.g. 0772 123 456' });
    return z.NEVER;
  }
  return e164;
});

/**
 * Mobile-money network for a Ugandan E.164 number, from its prefix:
 * MTN 076/077/078/079, Airtel 070/074/075. Null if the prefix is unknown.
 */
export const mobileMoneyNetwork = (e164: string): 'mtn_momo' | 'airtel_money' | null => {
  const prefix = e164.slice(4, 6);
  if (['76', '77', '78', '79'].includes(prefix)) return 'mtn_momo';
  if (['70', '74', '75'].includes(prefix)) return 'airtel_money';
  return null;
};
