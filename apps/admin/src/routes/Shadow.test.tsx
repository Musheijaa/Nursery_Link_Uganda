import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { http, server } from '../test/msw';
import { renderRoute } from '../test/render';
import Shadow from './Shadow';

// Leaflet needs a real browser; the map itself is covered by the Playwright journey
vi.mock('../features/shadow/ShadowMap', () => ({ default: () => <div data-testid="map" /> }));

const RUN = '00000000-0000-4000-8000-00000000a001';
const run = (status: 'queued' | 'running' | 'succeeded' | 'failed' = 'succeeded') => ({
  id: RUN,
  status,
  params: { threshold_pct: 20, since_year: 2010 },
  started_by: null,
  created_at: '2026-10-01T10:00:00.000Z',
  started_at: '2026-10-01T10:00:01.000Z',
  finished_at: status === 'succeeded' ? '2026-10-01T10:01:00.000Z' : null,
  error: status === 'failed' ? 'Routing is unavailable' : null,
  summary: { nurseries: 15, shadow_zones: 2, shadow_area_km2: 24.5 },
});
const square: [number, number][][][] = [[[[32.9, 0.05], [32.91, 0.05], [32.91, 0.06], [32.9, 0.05]]]];
const shadows = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, geometry: { type: 'MultiPolygon' as const, coordinates: square }, properties: { id: 7, loss_pct: 37.25, area_km2: 19.9, district: 'Mukono' } },
    { type: 'Feature' as const, geometry: { type: 'MultiPolygon' as const, coordinates: square }, properties: { id: 8, loss_pct: 22, area_km2: 4.6, district: null } },
  ],
};

const setup = (status: Parameters<typeof run>[0] = 'succeeded', sources = ['synthetic_dev_sample']) => {
  server.use(
    http.get('/admin/shadow/runs', ({ response }) => response(200).json({ data: [run(status)], meta: { page: 1, limit: 10, total: 1 } })),
    http.get('/admin/shadow/runs/{id}', ({ response }) => response(200).json({ data: run(status) })),
    http.get('/admin/shadow/runs/{id}/geojson', ({ query, response }) =>
      response(200).json({ data: query.get('layer') === 'shadows' ? shadows : { type: 'FeatureCollection', features: [] } })),
    http.get('/admin/nurseries', ({ response }) => response(200).json({ data: [], meta: { page: 1, limit: 100, total: 0 } })),
    http.get('/admin/audit-log', ({ response }) => response(200).json({
      data: [{ id: '1', action: 'forest_loss.load', entity: 'forest_loss_cells', entity_id: null, before: null, after: { sources, rows: 7014 }, actor: null, created_at: '2026-10-01T09:00:00.000Z' }],
      meta: { page: 1, limit: 1, total: 1 },
    }))
  );
  renderRoute(<Shadow />, { path: '/shadow', at: '/shadow' });
};

describe('Nursery Shadow page', () => {
  it('opens the latest run: summary, zones largest first, and the sample-data warning', async () => {
    setup();
    expect(await screen.findByText('2 shadow zones · 24.5 km² · 15 nurseries measured')).toBeInTheDocument();
    const rows = within(await screen.findByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Mukono19.9 km²37.3%');
    expect(rows[2]).toHaveTextContent('Outside the districts4.6 km²22%');
    expect(screen.getByText(/This is invented sample data/)).toBeInTheDocument();
    await userEvent.click(within(rows[2] as HTMLElement).getByRole('button', { name: 'Show on map' }));
    expect(rows[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('shows no warning for real data', async () => {
    setup('succeeded', ['Hansen_GFC-2023-v1.11_lossyear_10N_030E.tif']);
    expect(await screen.findByText(/cell-years loaded/)).toHaveTextContent('Hansen_GFC-2023');
    expect(screen.queryByText(/This is invented sample data/)).not.toBeInTheDocument();
  });

  it('explains a failed run', async () => {
    setup('failed');
    expect(await screen.findByRole('alert')).toHaveTextContent('This run failed: Routing is unavailable');
  });

  it('checks the settings with the shared schema before starting a run', async () => {
    let started: unknown = null;
    const NEW = '00000000-0000-4000-8000-00000000a002';
    setup();
    server.use(
      http.post('/admin/shadow/runs', async ({ request, response }) => {
        started = await request.json();
        return response(202).json({ data: { ...run('queued'), id: NEW }, meta: { outcome: 'new' as const } });
      }),
      http.get('/admin/shadow/runs/{id}', ({ params, response }) => response(200).json({ data: params.id === NEW ? { ...run('queued'), id: NEW } : run() }))
    );
    const since = await screen.findByLabelText('Counting loss since');
    await userEvent.clear(since);
    await userEvent.type(since, '1999');
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    await waitFor(() => { expect(since).toHaveAttribute('aria-invalid', 'true'); });
    expect(started).toBeNull();
    await userEvent.clear(since);
    await userEvent.type(since, '2015');
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(await screen.findByText(/^Started\./)).toBeInTheDocument();
    expect(await screen.findByText(/Measuring every nursery/)).toBeInTheDocument();
    expect(started).toEqual({ threshold_pct: 20, since_year: 2015 });
  });
});
