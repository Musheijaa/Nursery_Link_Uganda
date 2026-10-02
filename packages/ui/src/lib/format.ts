/** Formatting rules from docs/design-plan.md §A6. Pure functions, shared by both apps. */

const ugx = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 });
const count = new Intl.NumberFormat('en-UG');

/** 1500 → "UGX 1,500" */
export const formatUGX = (amount: number): string => `UGX ${ugx.format(amount)}`;

/** 12000 → "12,000" */
export const formatCount = (n: number): string => count.format(n);

/** 4.237 → "4.2 km by road"; straight-line estimates are marked approximate. */
export const formatDistance = (km: number, mode: 'road' | 'straight_line' = 'road'): string => {
  const value = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return mode === 'road' ? `${value} km by road` : `≈ ${value} km (approx.)`;
};

/** "+256772123456" → "+256 772 123 456" */
export const formatPhone = (e164: string): string => {
  const m = /^\+256(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `+256 ${m[1] ?? ''} ${m[2] ?? ''} ${m[3] ?? ''}` : e164;
};

/** "+256 772 123 456" → "tel:+256772123456" */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

const DAY = 24 * 60 * 60 * 1000;

/** Whole days since a date (0 = today). */
export const daysSince = (iso: string, now: Date = new Date()): number => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY));

/** "today", "yesterday", "3 days ago", "5 weeks ago", "4 months ago" */
export const formatRelative = (iso: string, now: Date = new Date()): string => {
  const days = daysSince(iso, now);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${String(days)} days ago`;
  if (days < 60) return `${String(Math.floor(days / 7))} weeks ago`;
  return `${String(Math.floor(days / 30))} months ago`;
};

/**
 * "just now", "25 minutes ago", "3 hours ago", then as formatRelative. For data that may be stale
 * by the hour (offline copies), where "today" says too little.
 */
export const formatAge = (iso: string, now: Date = new Date()): string => {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${String(minutes)} minutes ago`;
  if (minutes < 120) return '1 hour ago';
  if (minutes < 24 * 60) return `${String(Math.floor(minutes / 60))} hours ago`;
  return formatRelative(iso, now);
};

const dateTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' });
const dateOnly = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' });

/** "30 Sep 2026, 14:05" (Kampala time) */
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
/** "30 Sep 2026" */
export const formatDate = (iso: string): string => dateOnly.format(new Date(iso));
