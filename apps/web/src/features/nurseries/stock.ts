import { daysSince } from '@nurserylink/ui';

/** Stock older than this gets the amber "call to check" warning (FR-10). */
export const STALE_STOCK_DAYS = 30;

export const isStale = (iso: string | null, now = new Date()): boolean => iso !== null && daysSince(iso, now) > STALE_STOCK_DAYS;
