import { RecordingQueue } from '../../jobs/queue.js';
import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { PlaceDto, SuggestionDto } from '@nurserylink/shared';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { DownGeocoding, mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const deps = { config: testConfig(inject('databaseUrl')), pool, logger: pino({ level: 'silent' }), queue: new RecordingQueue() };
const app = createApp({ ...deps, providers: mockProviders() });
const appWithoutOsm = createApp({ ...deps, providers: { ...mockProviders(), geocoding: new DownGeocoding() } });

beforeAll(() => prepareTestDatabase(pool));
afterAll(() => pool.end());

const suggest = async (q: string, extra = '') =>
  ((await request(app).get(`/api/v1/search/suggest?q=${encodeURIComponent(q)}${extra}`).expect(200)).body as { data: SuggestionDto[] }).data;

describe('GET /search/suggest', () => {
  it('forgives spelling mistakes in tree names', async () => {
    for (const [typed, tree] of [['mvulle', 'Mvule'], ['musizzi', 'Musizi'], ['eucaliptus', 'Eucalyptus'], ['avacado', 'Hass avocado (grafted)']]) {
      const [first] = await suggest(typed ?? '');
      expect(first, typed).toMatchObject({ kind: 'species', label: tree });
    }
  });

  it('suggests from the first letters, and says when a local name matched', async () => {
    const [first] = await suggest('mv');
    expect(first).toMatchObject({ kind: 'species', label: 'Mvule' });
    const [muvule] = await suggest('muvule', '&types=species');
    expect(muvule).toMatchObject({ kind: 'species', label: 'Mvule', matched: 'Muvule' });
    expect(muvule?.kind === 'species' && muvule.nursery_count).toBeGreaterThan(0);
  });

  it('suggests nurseries and places, each with where it is', async () => {
    const [nursery] = await suggest('katossi', '&types=nursery');
    expect(nursery).toMatchObject({ kind: 'nursery', label: 'Katosi Lakeshore Seedlings', place: expect.stringContaining('Mukono') as unknown });
    const [place] = await suggest('nakisungga', '&types=place');
    expect(place).toMatchObject({ kind: 'place', label: 'Nakisunga', level: 'sub_county', parent_name: 'Mukono' });
    expect(place?.kind === 'place' && place.lat).toBeCloseTo(0.35, 0);
  });

  it('returns nothing for text that resembles nothing, and validates its query', async () => {
    expect(await suggest('zzqx')).toEqual([]);
    await request(app).get('/api/v1/search/suggest').expect(400);
    await request(app).get('/api/v1/search/suggest?q=mv&types=animals').expect(400);
    // LIKE wildcards are matched literally
    expect(await suggest('%')).toEqual([]);
  });
});

describe('spelling fallback in lists', () => {
  it('lists nurseries for the closest tree name when the search matches nothing as typed', async () => {
    const res = await request(app).get('/api/v1/nurseries?q=mvulle').expect(200);
    const body = res.body as { data: { name: string }[]; meta: { corrected_q?: string; total: number } };
    expect(body.meta.corrected_q).toBe('Mvule');
    expect(body.data.map(n => n.name)).toContain('Namilyango Tree Growers');

    const geo = (await request(app).get('/api/v1/nurseries?q=mvulle&format=geojson').expect(200)).body as { meta: { corrected_q?: string } };
    expect(geo.meta.corrected_q).toBe('Mvule');
  });

  it('leaves exact matches alone', async () => {
    const body = (await request(app).get('/api/v1/nurseries?q=mvule').expect(200)).body as { meta: { corrected_q?: string; total: number } };
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.meta.corrected_q).toBeUndefined();
  });

  it('corrects tree library searches too, and gives up on nonsense', async () => {
    const lib = (await request(app).get('/api/v1/species?q=grevelia').expect(200)).body as { data: { slug: string }[]; meta: { corrected_q?: string } };
    expect(lib.meta.corrected_q).toBe('Grevillea');
    expect(lib.data[0]?.slug).toBe('grevillea');
    const none = (await request(app).get('/api/v1/species?q=zzqx').expect(200)).body as { data: unknown[]; meta: { corrected_q?: string; total: number } };
    expect(none.meta).toMatchObject({ total: 0 });
    expect(none.meta.corrected_q).toBeUndefined();
  });
});

describe('GET /places', () => {
  it('puts our sub-counties first, then places from the geocoder', async () => {
    const res = await request(app).get('/api/v1/places?q=Nakisunga').expect(200);
    const body = res.body as { data: PlaceDto[]; meta: { osm: string } };
    expect(body.meta.osm).toBe('ok');
    expect(body.data[0]).toMatchObject({ source: 'boundary', name: 'Nakisunga', kind: 'sub_county', context: 'Mukono' });
    // The mock geocoder's place has the same name, so only ours is kept
    expect(body.data.filter(p => p.name === 'Nakisunga')).toHaveLength(1);

    const village = (await request(app).get('/api/v1/places?q=seeta market').expect(200)).body as { data: PlaceDto[] };
    expect(village.data).toContainEqual(expect.objectContaining({ source: 'osm', name: 'Seeta Market', boundary_id: null }));
  });

  it('still answers with our own places when OpenStreetMap is down', async () => {
    const body = (await request(appWithoutOsm).get('/api/v1/places?q=Nakisunga').expect(200)).body as { data: PlaceDto[]; meta: { osm: string } };
    expect(body.meta.osm).toBe('unavailable');
    expect(body.data.map(p => p.source)).toEqual(['boundary']);
  });

  it('needs at least two letters', async () => {
    await request(app).get('/api/v1/places?q=s').expect(400);
  });
});
