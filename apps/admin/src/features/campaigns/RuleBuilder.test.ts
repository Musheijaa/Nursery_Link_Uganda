import { describe, expect, it } from 'vitest';
import { toRules } from './RuleBuilder';

describe('toRules', () => {
  it('keeps saved keys (answers use them) and makes unique keys for new rules from the label', () => {
    expect(
      toRules([
        { key: 'coffee_farmer', label: 'I grow coffee', type: 'boolean', required: true },
        { key: null, label: 'Number of coffee trees?', type: 'number', required: true },
        { key: null, label: 'Number of coffee trees?', type: 'number', required: false },
        { key: null, label: '  ', type: 'text', required: false },
        { key: null, label: '20 acres or more', type: 'boolean', required: false },
      ])
    ).toEqual([
      { key: 'coffee_farmer', label: 'I grow coffee', type: 'boolean', required: true },
      { key: 'number_of_coffee_trees', label: 'Number of coffee trees?', type: 'number', required: true },
      { key: 'number_of_coffee_trees_2', label: 'Number of coffee trees?', type: 'number', required: false },
      { key: 'q_20_acres_or_more', label: '20 acres or more', type: 'boolean', required: false },
    ]);
  });

  it('never reuses a saved key for a new rule', () => {
    const rules = toRules([
      { key: null, label: 'Owner', type: 'text', required: false },
      { key: 'owner', label: 'Land owner', type: 'boolean', required: true },
    ]);
    expect(rules.map(r => r.key)).toEqual(['owner_2', 'owner']);
  });
});
