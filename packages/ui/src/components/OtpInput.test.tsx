import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OtpInput } from './OtpInput';

const Harness = ({ onComplete }: { onComplete?: (v: string) => void }) => {
  const [value, setValue] = useState('');
  return (
    <>
      <OtpInput label="Verification code" value={value} onChange={setValue} {...(onComplete ? { onComplete } : {})} />
      <output data-testid="value">{value}</output>
    </>
  );
};

const boxes = () => screen.getAllByRole('textbox');

describe('OtpInput', () => {
  it('renders six labelled boxes, the first set up for SMS autofill', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument();
    expect(boxes()).toHaveLength(6);
    expect(boxes()[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(boxes()[0]).toHaveAttribute('inputmode', 'numeric');
    expect(boxes()[3]).toHaveAccessibleName('Digit 4 of 6');
  });

  it('moves to the next box as digits are typed, ignores letters, and reports completion', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(boxes()[0] as HTMLElement);
    await userEvent.keyboard('12a3456');
    expect(screen.getByTestId('value')).toHaveTextContent('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('goes back with Backspace', async () => {
    render(<Harness />);
    await userEvent.click(boxes()[0] as HTMLElement);
    await userEvent.keyboard('123');
    await userEvent.keyboard('{Backspace}{Backspace}');
    expect(screen.getByTestId('value')).toHaveTextContent(/^1$/);
    expect(boxes()[1]).toHaveFocus();
  });

  it('fills every box from a pasted code, keeping only digits', async () => {
    render(<Harness />);
    await userEvent.click(boxes()[0] as HTMLElement);
    await userEvent.paste('Code: 482 913');
    expect(screen.getByTestId('value')).toHaveTextContent('482913');
    expect(boxes().map(b => (b as HTMLInputElement).value)).toEqual(['4', '8', '2', '9', '1', '3']);
  });
});
