import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { http, server } from '../test/msw';
import { renderRoute } from '../test/render';
import Insights from './Insights';

const kpi = (value: number, previous: number) => ({ value, previous });
const analytics = (range: '30d' | '90d' | '12m') => ({
  range,
  bucket: range === '30d' ? ('day' as const) : range === '90d' ? ('week' as const) : ('month' as const),
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-10-01T12:00:00.000Z',
  kpis: {
    sales_ugx: kpi(1_500_000, 1_000_000),
    orders: kpi(6, 4),
    seedlings_sold: kpi(900, 0),
    avg_order_ugx: kpi(250_000, 250_000),
    new_buyers: kpi(2, 3),
    free_seedlings: kpi(0, 0),
  },
  series: [
    { date: '2026-09-30', sales_ugx: 500_000, orders: 2 },
    { date: '2026-10-01', sales_ugx: 1_000_000, orders: 4 },
  ],
  order_status: [{ status: 'released' as const, count: 5 }, { status: 'disputed' as const, count: 1 }],
  delivery: [{ type: 'order_and_deliver' as const, count: 4 }, { type: 'self_pickup' as const, count: 2 }],
  payment_methods: [{ method: 'mtn_momo' as const, count: 5, sales_ugx: 1_200_000 }, { method: 'airtel_money' as const, count: 1, sales_ugx: 300_000 }],
  top_species: [{ species_id: '00000000-0000-4000-8000-0000000000a1', common_name: 'Mvule', seedlings: 600, sales_ugx: 1_080_000 }],
  top_nurseries: [{ nursery_id: '00000000-0000-4000-8000-0000000000b1', name: 'Mukono Town Nursery', orders: 4, sales_ugx: 1_000_000 }],
  stock_by_category: [{ category: 'indigenous' as const, seedlings: 3000, lines: 4 }],
  campaigns: [{ id: '00000000-0000-4000-8000-0000000000c1', title: 'Coffee shade trees', allocated: 1000, remaining: 750, applications: 3 }],
});

describe('Insights', () => {
  it('shows each figure with its change, the charts and their figures in text', async () => {
    const asked: string[] = [];
    server.use(http.get('/admin/analytics', ({ query, response }) => {
      const range = query.get('range') ?? '30d';
      asked.push(range);
      return response(200).json({ data: analytics(range) });
    }));
    renderRoute(<Insights />, { path: '/insights', at: '/insights' });

    expect(await screen.findByText('UGX 1,500,000')).toBeInTheDocument();
    expect(screen.getByText('Sales').closest('div')).toHaveTextContent('up 50% vs the 30 days before');
    expect(screen.getByText('Seedlings sold').closest('div')).toHaveTextContent('New');
    expect(screen.getByText('Average order').closest('div')).toHaveTextContent('No change');
    expect(screen.getByText('New buyers').closest('div')).toHaveTextContent('down 33%');

    // Donut legends list every figure with its share
    const payments = screen.getByRole('region', { name: 'How buyers pay' });
    expect(within(payments).getByText('MTN MoMo').closest('li')).toHaveTextContent('583%');
    // The sales chart's figures are available as a table
    expect(screen.getByRole('table', { name: 'Figures behind the chart' })).toHaveTextContent('1 OctUGX 1,000,000');
    expect(screen.getByRole('region', { name: 'Free-seedling campaigns' })).toHaveTextContent('250 of 1,000 given out');

    await userEvent.click(screen.getByRole('button', { name: 'Last 12 months' }));
    expect(await screen.findAllByText('vs the year before', { exact: false })).toHaveLength(6);
    expect(asked).toEqual(['30d', '12m']);
  });
});
