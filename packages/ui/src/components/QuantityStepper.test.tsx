import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { QuantityStepper } from './QuantityStepper';

const Harness = ({ max, start = 0 }: { max: number; start?: number }) => {
  const [value, setValue] = useState(start);
  return (
    <>
      <QuantityStepper label="Mvule seedlings" value={value} onChange={setValue} max={max} />
      <output data-testid="value">{value}</output>
    </>
  );
};

describe('QuantityStepper', () => {
  it('steps up and down within 0 and the stock available', async () => {
    render(<Harness max={2} />);
    const more = screen.getByRole('button', { name: 'More Mvule seedlings' });
    const fewer = screen.getByRole('button', { name: 'Fewer Mvule seedlings' });
    expect(fewer).toBeDisabled();
    await userEvent.click(more);
    await userEvent.click(more);
    expect(screen.getByTestId('value')).toHaveTextContent('2');
    expect(more).toBeDisabled();
    await userEvent.click(fewer);
    expect(screen.getByTestId('value')).toHaveTextContent('1');
  });

  it('caps a typed quantity at the stock available', async () => {
    render(<Harness max={1200} />);
    const input = screen.getByRole('textbox', { name: 'Mvule seedlings' });
    await userEvent.clear(input);
    await userEvent.type(input, '5000{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('1200');
    expect(input).toHaveValue('1200');
  });

  it('treats an empty or non-numeric entry as zero', async () => {
    render(<Harness max={50} start={10} />);
    const input = screen.getByRole('textbox', { name: 'Mvule seedlings' });
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    await userEvent.tab();
    expect(screen.getByTestId('value')).toHaveTextContent('0');
  });

  it('shows the maximum', () => {
    render(<Harness max={1200} />);
    expect(screen.getByText('max 1,200')).toBeInTheDocument();
  });
});
