import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { http, server } from '../../test/msw';
import { LocationProbe, renderRoute } from '../../test/render';
import { BoundaryFilters } from './Filters';
import { useNurseryParams } from './params';

const MUKONO = '00000000-0000-4000-8000-0000000000d1';
const WAKISO = '00000000-0000-4000-8000-0000000000d2';
const sub = (id: string, name: string, parent: string) => ({ id, name, level: 'sub_county' as const, parent_id: parent });

const Harness = () => {
  const { params, update } = useNurseryParams();
  return (
    <>
      <BoundaryFilters district={params.district} subCounty={params.subCounty} onChange={update} />
      <LocationProbe />
    </>
  );
};

const mockBoundaries = (requestedParents: (string | null)[]) => {
  server.use(
    http.get('/boundaries', ({ query, response }) => {
      if (query.get('level') === 'district') {
        return response(200).json({ data: [{ id: MUKONO, name: 'Mukono', level: 'district', parent_id: null }, { id: WAKISO, name: 'Wakiso', level: 'district', parent_id: null }] });
      }
      const parent = query.get('parent_id');
      requestedParents.push(parent);
      const subs = parent === MUKONO
        ? [sub('00000000-0000-4000-8000-0000000000a1', 'Goma', MUKONO), sub('00000000-0000-4000-8000-0000000000a2', 'Ntenjeru', MUKONO)]
        : [sub('00000000-0000-4000-8000-0000000000b1', 'Kira', WAKISO)];
      return response(200).json({ data: subs });
    })
  );
};

describe('District → Sub-county filters', () => {
  it('keeps the sub-county closed until a district is chosen, then lists only that district', async () => {
    const parents: (string | null)[] = [];
    mockBoundaries(parents);
    renderRoute(<Harness />, { path: '/nurseries', at: '/nurseries' });

    const district = screen.getByLabelText('District');
    const subCounty = screen.getByLabelText('Sub-county');
    expect(subCounty).toBeDisabled();
    expect(within(subCounty).getByRole('option')).toHaveTextContent('Pick district');

    await screen.findByRole('option', { name: 'Mukono' });
    await userEvent.selectOptions(district, 'Mukono');
    expect(await within(subCounty).findByRole('option', { name: 'Ntenjeru' })).toBeInTheDocument();
    expect(subCounty).toBeEnabled();
    expect(within(subCounty).queryByRole('option', { name: 'Kira' })).not.toBeInTheDocument();
    expect(parents).toEqual([MUKONO]);
    expect(screen.getByTestId('location')).toHaveTextContent(`/nurseries?district=${MUKONO}`);
  });

  it('keeps both choices in the URL, and clears the sub-county when the district changes', async () => {
    mockBoundaries([]);
    renderRoute(<Harness />, { path: '/nurseries', at: '/nurseries' });
    await screen.findByRole('option', { name: 'Mukono' });
    await userEvent.selectOptions(screen.getByLabelText('District'), 'Mukono');
    await screen.findByRole('option', { name: 'Ntenjeru' });
    await userEvent.selectOptions(screen.getByLabelText('Sub-county'), 'Ntenjeru');
    expect(screen.getByTestId('location')).toHaveTextContent('sub_county=00000000-0000-4000-8000-0000000000a2');

    await userEvent.selectOptions(screen.getByLabelText('District'), 'Wakiso');
    await waitFor(() => { expect(screen.getByTestId('location')).toHaveTextContent(`/nurseries?district=${WAKISO}`); });
    expect(screen.getByTestId('location')).not.toHaveTextContent('sub_county');
    expect(await screen.findByRole('option', { name: 'Kira' })).toBeInTheDocument();
  });

  it('restores both filters from a shared link', async () => {
    mockBoundaries([]);
    renderRoute(<Harness />, { path: '/nurseries', at: `/nurseries?district=${MUKONO}&sub_county=00000000-0000-4000-8000-0000000000a1` });
    await screen.findByRole('option', { name: 'Goma' });
    await waitFor(() => { expect(screen.getByLabelText('Sub-county')).toHaveValue('00000000-0000-4000-8000-0000000000a1'); });
    expect(screen.getByLabelText('District')).toHaveValue(MUKONO);
  });
});
