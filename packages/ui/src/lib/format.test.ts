import { describe, expect, it } from 'vitest';
import { daysSince, formatAge, formatDistance, formatPhone, formatRelative, formatUGX, telHref } from './format';

describe('format', () => {
  it('formats money, distance and phones the Ugandan way', () => {
    expect(formatUGX(1500)).toBe('UGX 1,500');
    expect(formatUGX(317000)).toBe('UGX 317,000');
    expect(formatDistance(4.237)).toBe('4.2 km by road');
    expect(formatDistance(23.6)).toBe('24 km by road');
    expect(formatDistance(4.2, 'straight_line')).toBe('≈ 4.2 km (approx.)');
    expect(formatPhone('+256772123456')).toBe('+256 772 123 456');
    expect(telHref('+256 772 123 456')).toBe('tel:+256772123456');
  });

  it('describes how long ago something happened', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    expect(formatRelative('2026-10-01T08:00:00Z', now)).toBe('today');
    expect(formatRelative('2026-09-30T08:00:00Z', now)).toBe('yesterday');
    expect(formatRelative('2026-09-28T08:00:00Z', now)).toBe('3 days ago');
    expect(formatRelative('2026-08-20T08:00:00Z', now)).toBe('6 weeks ago');
    expect(daysSince('2026-08-20T12:00:00Z', now)).toBe(42);
  });
});

describe('formatAge', () => {
  it('counts minutes and hours within a day, then falls back to days', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    expect(formatAge('2026-10-01T11:59:30Z', now)).toBe('just now');
    expect(formatAge('2026-10-01T11:35:00Z', now)).toBe('25 minutes ago');
    expect(formatAge('2026-10-01T10:30:00Z', now)).toBe('1 hour ago');
    expect(formatAge('2026-10-01T05:00:00Z', now)).toBe('7 hours ago');
    expect(formatAge('2026-09-29T08:00:00Z', now)).toBe('2 days ago');
  });
});

