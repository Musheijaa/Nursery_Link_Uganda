import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Diff } from './Diff';

describe('Diff', () => {
  it('lists every field, highlighting the ones that changed', () => {
    render(<Diff before={{ quantity_available: 1622, unit_price: 1800 }} after={{ quantity_available: 1756, unit_price: 1800, source: 'csv_import' }} />);
    const qty = screen.getByRole('row', { name: /quantity_available/ });
    expect(qty).not.toHaveClass('text-bark-muted');
    expect(screen.getByRole('row', { name: /unit_price/ })).toHaveClass('text-bark-muted');
    expect(screen.getByRole('row', { name: /source/ })).toHaveTextContent('csv_import');
  });

  it('says so when nothing was recorded', () => {
    render(<Diff before={null} after={null} />);
    expect(screen.getByText('No details recorded')).toBeInTheDocument();
  });
});
