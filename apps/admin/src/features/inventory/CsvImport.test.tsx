import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { http, server } from '../../test/msw';
import { renderRoute } from '../../test/render';
import { CsvImport } from './CsvImport';

const change = { row: 2, nursery: 'Mukono Town Nursery', species: 'Mvule', action: 'update' as const, before: { quantity_available: 1200, unit_price: 1800 }, after: { quantity_available: 1300, unit_price: 1800 } };
const result = (committed: boolean, errors: { row: number; column?: string; message: string }[] = []) => ({
  committed,
  rows: 1 + errors.length,
  errors,
  summary: { create: 0, update: errors.length ? 0 : 1, unchanged: 0 },
  changes: errors.length ? [] : [change],
});
const csv = (body: string) => new File([`nursery_name,species_slug,quantity,unit_price\n${body}`], 'stock.csv', { type: 'text/csv' });

describe('CsvImport', () => {
  it('shows row errors from the dry run and offers no commit', async () => {
    server.use(http.post('/admin/inventory/import', ({ response }) =>
      response(400).json({ error: { code: 'validation_error', message: 'Some rows are not valid', details: result(false, [{ row: 3, column: 'species_slug', message: 'Unknown species "not-a-tree"' }]) } })));
    renderRoute(<CsvImport />);
    await userEvent.upload(screen.getByLabelText('Choose a CSV file'), csv('Mukono Town Nursery,not-a-tree,10,100\n'));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 row has a problem');
    expect(screen.getByText('species_slug: Unknown species "not-a-tree"')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Apply/ })).not.toBeInTheDocument();
  });

  it('previews the changes, then commits the same file', async () => {
    const calls: string[] = [];
    server.use(http.post('/admin/inventory/import', async ({ request, response }) => {
      const commit = new URL(request.url).searchParams.get('commit') === 'true';
      calls.push(`${String(commit)}:${(await request.text()).split('\n')[1] ?? ''}`);
      return response(200).json({ data: result(commit) });
    }));
    renderRoute(<CsvImport />);
    await userEvent.upload(screen.getByLabelText('Choose a CSV file'), csv('Mukono Town Nursery,mvule,1300,1800\n'));
    expect(await screen.findByText('0 new · 1 changed · 0 unchanged')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1 stock line updated');
    expect(calls).toEqual(['false:Mukono Town Nursery,mvule,1300,1800', 'true:Mukono Town Nursery,mvule,1300,1800']);
  });
});
