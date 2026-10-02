import { describe, expect, it } from 'vitest';
import type { EligibilityRule } from './enums.js';
import { checkEligibility } from './eligibility.js';

const rules: EligibilityRule[] = [
  { key: 'lc1_letter', label: 'I have an LC1 letter', type: 'boolean', required: true },
  { key: 'land_acres', label: 'Land (acres)', type: 'number', required: true },
  { key: 'farmer_group', label: 'Farmer group', type: 'text', required: false },
  { key: 'has_water', label: 'Water on site', type: 'boolean', required: false },
];

describe('checkEligibility', () => {
  it('accepts complete answers and trims text', () => {
    expect(checkEligibility(rules, { lc1_letter: true, land_acres: 2.5, farmer_group: '  Seeta Women Group ', has_water: false })).toEqual({
      ok: true,
      answers: { lc1_letter: true, land_acres: 2.5, farmer_group: 'Seeta Women Group', has_water: false },
    });
  });

  it('lets optional questions be skipped or left blank', () => {
    expect(checkEligibility(rules, { lc1_letter: true, land_acres: 0, farmer_group: '  ' })).toEqual({ ok: true, answers: { lc1_letter: true, land_acres: 0 } });
  });

  it('requires required answers', () => {
    const result = checkEligibility(rules, { lc1_letter: true });
    expect(result).toEqual({ ok: false, problems: [{ path: 'answers.land_acres', message: 'Answer "Land (acres)"' }] });
  });

  it('treats a "no" to a required yes/no question as not eligible', () => {
    const result = checkEligibility(rules, { lc1_letter: false, land_acres: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.message).toMatch(/^Not eligible/);
  });

  it('checks types and ranges, and rejects questions the campaign does not ask', () => {
    const result = checkEligibility(rules, { lc1_letter: 'yes', land_acres: -1, farmer_group: 3, extra: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map(p => p.path).sort()).toEqual(['answers.extra', 'answers.farmer_group', 'answers.land_acres', 'answers.lc1_letter']);
  });

  it('accepts empty answers for a campaign with no checklist', () => {
    expect(checkEligibility([], {})).toEqual({ ok: true, answers: {} });
  });
});
