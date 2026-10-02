import type { EligibilityRule } from './enums.js';

export type Answers = Record<string, boolean | number | string>;
/** Alias used by the apps for an application's answers */
export type EligibilityAnswers = Answers;
export interface EligibilityProblem {
  path: string;
  message: string;
}

/**
 * Checks answers against a campaign's checklist:
 *  - every required question is answered, with the right type;
 *  - no answers to questions the campaign does not ask;
 *  - a required yes/no question must be answered "yes" (it is a condition of eligibility);
 *  - numbers are finite and not negative; text is not blank.
 * Returns the cleaned answers (text trimmed, optional blanks dropped) or every problem found.
 */
export const checkEligibility = (rules: EligibilityRule[], answers: Answers): { ok: true; answers: Answers } | { ok: false; problems: EligibilityProblem[] } => {
  const problems: EligibilityProblem[] = [];
  const cleaned: Answers = {};
  const known = new Set(rules.map(r => r.key));

  for (const key of Object.keys(answers)) {
    if (!known.has(key)) problems.push({ path: `answers.${key}`, message: 'This campaign does not ask this question' });
  }

  for (const rule of rules) {
    const path = `answers.${rule.key}`;
    const raw = answers[rule.key];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value === undefined || value === '') {
      if (rule.required) problems.push({ path, message: `Answer "${rule.label}"` });
      continue;
    }
    switch (rule.type) {
      case 'boolean':
        if (typeof value !== 'boolean') problems.push({ path, message: `"${rule.label}" must be yes or no` });
        else if (rule.required && !value) problems.push({ path, message: `Not eligible: "${rule.label}" is required` });
        else cleaned[rule.key] = value;
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) problems.push({ path, message: `"${rule.label}" must be a number of 0 or more` });
        else cleaned[rule.key] = value;
        break;
      case 'text':
        if (typeof value !== 'string') problems.push({ path, message: `"${rule.label}" must be text` });
        else cleaned[rule.key] = value;
        break;
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true, answers: cleaned };
};
