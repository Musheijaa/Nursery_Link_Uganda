import type { EligibilityRule } from '@nurserylink/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EligibilityForm } from './EligibilityForm';

const rules: EligibilityRule[] = [
  { key: 'lc1_letter', label: 'I have an introduction letter from my LC1 chairperson', type: 'boolean', required: true },
  { key: 'land_acres', label: 'Land to be planted (acres)', type: 'number', required: true },
  { key: 'farmer_group', label: 'Farmer group (if any)', type: 'text', required: false },
];

const setup = () => {
  const onSubmit = vi.fn();
  render(<EligibilityForm rules={rules} maxQuantity={500} onSubmit={onSubmit} busy={false} />);
  return onSubmit;
};

describe('EligibilityForm (generated from eligibility_rules)', () => {
  it('builds the right control for each kind of question, marking the required ones', () => {
    setup();
    expect(screen.getByRole('checkbox', { name: 'Yes, this is true for me' })).toBeInTheDocument();
    expect(screen.getByText('I have an introduction letter from my LC1 chairperson')).toBeInTheDocument();
    expect(screen.getByLabelText('Land to be planted (acres) (required)')).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByLabelText('Farmer group (if any)')).toHaveAttribute('inputmode', 'text');
    expect(screen.getByLabelText(/How many seedlings/)).toBeInTheDocument();
  });

  it('applies the same rules as the API: required answers, a "yes" to required checks, quantity in range', async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText(/How many seedlings/), '900');
    await userEvent.click(screen.getByRole('button', { name: 'Apply for free seedlings' }));
    expect(await screen.findByText('Not eligible: "I have an introduction letter from my LC1 chairperson" is required')).toBeInTheDocument();
    expect(screen.getByText('Answer "Land to be planted (acres)"')).toBeInTheDocument();
    expect(screen.getByText('Enter a number from 1 to 500.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends typed answers (numbers as numbers, blank optional answers left out)', async () => {
    const onSubmit = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Yes, this is true for me' }));
    await userEvent.type(screen.getByLabelText('Land to be planted (acres) (required)'), '2.5');
    await userEvent.type(screen.getByLabelText(/How many seedlings/), '120');
    await userEvent.click(screen.getByRole('button', { name: 'Apply for free seedlings' }));
    await vi.waitFor(() => { expect(onSubmit).toHaveBeenCalled(); });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ answers: { lc1_letter: true, land_acres: 2.5 }, quantity_requested: 120 });
  });

  it('clears an error as soon as the answer is fixed', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Apply for free seedlings' }));
    expect(await screen.findByText('Answer "Land to be planted (acres)"')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Land to be planted (acres) (required)'), '3');
    expect(screen.queryByText('Answer "Land to be planted (acres)"')).not.toBeInTheDocument();
  });
});
