import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { en } from '../../copy/en';
import { PlantingCalendar } from './PlantingCalendar';

describe('PlantingCalendar', () => {
  it('marks this month and says what to do in the rains', () => {
    render(<PlantingCalendar now={new Date('2026-10-02T09:00:00Z')} />);
    expect(screen.getByRole('listitem', { current: 'date' })).toHaveTextContent('October: Planting season');
    expect(screen.getByText(en.news.calendar.todo.rains)).toBeInTheDocument();
  });

  it('uses Kampala time, so the last evening of July (UTC) is already August: get ready', () => {
    render(<PlantingCalendar now={new Date('2026-07-31T22:30:00Z')} />);
    expect(screen.getByRole('listitem', { current: 'date' })).toHaveTextContent('August: Get ready');
    expect(screen.getByText(en.news.calendar.todo.prep)).toBeInTheDocument();
  });

  it('gives dry-season care in January', () => {
    render(<PlantingCalendar now={new Date('2026-01-15T09:00:00Z')} />);
    expect(screen.getByText(en.news.calendar.todo.dry)).toBeInTheDocument();
  });
});
