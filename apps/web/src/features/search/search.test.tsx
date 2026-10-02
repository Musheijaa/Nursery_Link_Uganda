import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SearchBox } from '../../components/SearchBox';
import { http, server } from '../../test/msw';
import { LocationProbe, renderRoute } from '../../test/render';
import { nurserySuggest } from '../nurseries/Filters';
import { useNurseryParams } from '../nurseries/params';
import { PlaceSearch, type PickedPlace } from './PlaceSearch';

const MUKONO = '00000000-0000-4000-8000-0000000000d1';
const NAKISUNGA = '00000000-0000-4000-8000-0000000000a1';

const NurserySearch = () => {
  const { params, update } = useNurseryParams();
  return (
    <>
      <SearchBox value={params.q} onChange={q => { update({ q }, { replace: true }); }} suggest={nurserySuggest(update)} />
      <LocationProbe />
    </>
  );
};

describe('search suggestions', () => {
  it('suggests the right tree for a misspelling and searches for it when chosen with the keyboard', async () => {
    const asked: string[] = [];
    server.use(
      http.get('/search/suggest', ({ query, response }) => {
        asked.push(query.get('q'));
        return response(200).json({
          data: [
            { kind: 'species', slug: 'mvule', label: 'Mvule', scientific_name: 'Milicia excelsa', matched: null, nursery_count: 3 },
            { kind: 'place', id: NAKISUNGA, label: 'Nakisunga', level: 'sub_county', parent_id: MUKONO, parent_name: 'Mukono', lat: 0.3, lng: 32.8 },
          ],
        });
      })
    );
    renderRoute(<NurserySearch />, { path: '/nurseries', at: '/nurseries' });
    const box = screen.getByRole('combobox', { name: 'Search a tree or nursery' });
    await userEvent.type(box, 'mvulle');

    const option = await screen.findByRole('option', { name: /Mvule.*Milicia excelsa.*At 3 nurseries/ });
    expect(asked).toContain('mvulle');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/2 suggestions/)).toBeInTheDocument();

    await userEvent.keyboard('{ArrowDown}');
    expect(box).toHaveAttribute('aria-activedescendant', option.id);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => { expect(screen.getByTestId('location')).toHaveTextContent('/nurseries?q=Mvule'); });
    expect(box).toHaveValue('Mvule');
    expect(box).toHaveAttribute('aria-expanded', 'false');
  });

  it('turns a chosen sub-county into the district and sub-county filters', async () => {
    server.use(
      http.get('/search/suggest', ({ response }) =>
        response(200).json({ data: [{ kind: 'place', id: NAKISUNGA, label: 'Nakisunga', level: 'sub_county', parent_id: MUKONO, parent_name: 'Mukono', lat: 0.3, lng: 32.8 }] })
      )
    );
    renderRoute(<NurserySearch />, { path: '/nurseries', at: '/nurseries' });
    await userEvent.type(screen.getByRole('combobox'), 'nakisu');
    await userEvent.click(await screen.findByRole('option', { name: /Nakisunga.*Sub-county, Mukono District/ }));
    await waitFor(() => { expect(screen.getByTestId('location')).toHaveTextContent(`district=${MUKONO}&sub_county=${NAKISUNGA}`); });
    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});

describe('PlaceSearch', () => {
  it('suggests our places as you type, then asks OpenStreetMap only when Search is pressed', async () => {
    let placeRequests = 0;
    server.use(
      http.get('/search/suggest', ({ query, response }) => {
        expect(query.get('types')).toBe('place');
        return response(200).json({ data: [] });
      }),
      http.get('/places', ({ query, response }) => {
        placeRequests++;
        expect(query.get('q')).toBe('Seeta market');
        return response(200).json({
          data: [{ source: 'osm', boundary_id: null, name: 'Seeta Market', context: 'Goma Division, Mukono, Uganda', kind: 'marketplace', lat: 0.36, lng: 32.71 }],
          meta: { osm: 'ok' },
        });
      })
    );
    const picked: PickedPlace[] = [];
    renderRoute(<PlaceSearch id="p" onPick={p => { picked.push(p); }} />);
    const box = screen.getByRole('combobox', { name: 'Type a place' });
    await userEvent.type(box, 'Seeta market');
    expect(await screen.findByText(/Press Search to look up villages/, { selector: 'li' })).toBeInTheDocument();
    expect(placeRequests).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('option', { name: /Seeta Market.*Goma Division/ }));
    expect(placeRequests).toBe(1);
    expect(picked).toEqual([{ lat: 0.36, lng: 32.71, name: 'Seeta Market', context: 'Goma Division, Mukono, Uganda' }]);
  });

  it('says when nothing is found, and when OpenStreetMap is down', async () => {
    let osm: 'ok' | 'unavailable' = 'ok';
    server.use(http.get('/places', ({ response }) => response(200).json({ data: [], meta: { osm } })));
    renderRoute(<PlaceSearch id="p" onPick={() => undefined} />);
    const box = screen.getByRole('combobox');
    await userEvent.type(box, 'Kigoogwa{Enter}');
    expect(await screen.findByText('We couldn’t find “Kigoogwa”. Try a nearby town or trading centre, or tap the map.', { selector: 'li' })).toBeInTheDocument();
    osm = 'unavailable';
    await userEvent.type(box, 'a{Enter}');
    expect(await screen.findByText(/Village and landmark search is unavailable/, { selector: 'li' })).toBeInTheDocument();
  });
});
