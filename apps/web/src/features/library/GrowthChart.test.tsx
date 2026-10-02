import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GrowthChart } from './GrowthChart';

describe('GrowthChart', () => {
  it('describes every milestone for screen readers and labels the years', () => {
    render(<GrowthChart timeline={[{ years: 15, height_m: 18 }, { years: 1, height_m: 1 }, { years: 40, height_m: 35 }]} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('1 year: about 1 m tall; 15 years: about 18 m tall; 40 years: about 35 m tall');
    expect(screen.getByText('40 years')).toBeInTheDocument();
    // The height axis rounds up to a readable maximum
    expect(screen.getByText('40 m')).toBeInTheDocument();
  });
});
