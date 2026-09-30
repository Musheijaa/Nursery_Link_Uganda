import { PaymentNetwork } from '../types';

/** Normalises Ugandan mobile numbers (07…, 2567…, +256 7…) to 07XXXXXXXX, or null if invalid. */
export const normaliseUgandanMobile = (input: string): string | null => {
  const digits = input.replace(/[^\d]/g, '');
  const local = digits.startsWith('256') ? `0${digits.slice(3)}` : digits;
  return /^07\d{8}$/.test(local) ? local : null;
};

const MTN_PREFIXES = ['076', '077', '078'];
const AIRTEL_PREFIXES = ['070', '074', '075'];

export const detectNetwork = (normalised: string): PaymentNetwork | null => {
  const prefix = normalised.slice(0, 3);
  if (MTN_PREFIXES.includes(prefix)) return 'MTN MoMo';
  if (AIRTEL_PREFIXES.includes(prefix)) return 'Airtel Money';
  return null;
};

/** 0772123456 -> 0772 123 456 */
export const formatPhone = (normalised: string) =>
  `${normalised.slice(0, 4)} ${normalised.slice(4, 7)} ${normalised.slice(7)}`;

/** 0772123456 -> 256772123456 (for tel: and WhatsApp links) */
export const toInternational = (normalised: string) => `256${normalised.slice(1)}`;
