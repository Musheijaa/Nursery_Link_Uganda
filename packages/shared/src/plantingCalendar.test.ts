import { describe, expect, it } from 'vitest';
import { kampalaMonth, nextSeasonStart, seasonOfMonth } from './plantingCalendar.js';

describe('planting calendar', () => {
  it('has two rainy seasons, each with a month to get ready before it', () => {
    expect([2, 3, 4, 8, 9, 10].map(seasonOfMonth)).toEqual(Array(6).fill('rains'));
    expect([1, 7].map(seasonOfMonth)).toEqual(['prep', 'prep']);
    expect([0, 5, 6, 11].map(seasonOfMonth)).toEqual(Array(4).fill('dry'));
  });

  it('finds when the next rains start, across the new year', () => {
    expect(nextSeasonStart(11, 'rains')).toBe(2); // December → March
    expect(nextSeasonStart(5, 'rains')).toBe(8); // June → September
    expect(nextSeasonStart(3, 'rains')).toBe(8); // during the first rains → September
  });

  it('reads the month in Kampala time (UTC+3)', () => {
    expect(kampalaMonth(new Date('2026-11-30T22:30:00Z'))).toBe(11); // already 1 December in Kampala
  });
});
