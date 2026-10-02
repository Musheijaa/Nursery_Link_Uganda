import { describe, expect, it } from 'vitest';
import { ProviderUnavailableError } from '../../lib/errors.js';
import { MockGeocoding } from './mockGeocoding.js';
import { NominatimGeocoding, type NominatimOptions } from './nominatim.js';

const SEETA = [
  { lat: '0.3612', lon: '32.7127', name: 'Seeta', display_name: 'Seeta, Goma Division, Mukono, Central Region, Uganda', type: 'village', addresstype: 'village' },
  { lat: 'x', lon: '32', display_name: 'Broken, Uganda' },
];

/** A Nominatim client with a fake clock and a recording fetch. */
const setup = (body: unknown = SEETA, status = 200, extra: Partial<NominatimOptions> = {}) => {
  let clock = 1_000_000;
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const sleeps: number[] = [];
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  }) as typeof fetch;
  const geocoder = new NominatimGeocoding({
    baseUrl: 'https://nominatim.example/',
    userAgent: 'NurseryLinkUganda/test (ops@example.test)',
    fetchImpl,
    now: () => clock,
    sleep: ms => { sleeps.push(ms); clock += ms; return Promise.resolve(); },
    ...extra,
  });
  return { geocoder, calls, sleeps, advance: (ms: number) => { clock += ms; } };
};

describe('NominatimGeocoding', () => {
  it('searches Uganda only, identifies itself, and maps results (dropping unusable ones)', async () => {
    const { geocoder, calls } = setup();
    const places = await geocoder.search('  seeta  ', 5);
    expect(places).toEqual([{ name: 'Seeta', context: 'Goma Division, Mukono, Central Region, Uganda', kind: 'village', lat: 0.3612, lng: 32.7127 }]);
    const url = new URL(calls[0]?.url ?? '');
    expect(url.origin + url.pathname).toBe('https://nominatim.example/search');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: 'seeta', format: 'jsonv2', countrycodes: 'ug', limit: '5' });
    expect(new Headers(calls[0]?.init?.headers).get('User-Agent')).toBe('NurseryLinkUganda/test (ops@example.test)');
  });

  it('answers repeated searches from its cache', async () => {
    const { geocoder, calls } = setup();
    await geocoder.search('Seeta', 5);
    await geocoder.search('SEETA', 5);
    expect(calls).toHaveLength(1);
  });

  it('spaces requests at least a second apart, and refuses rather than queue for long', async () => {
    const { geocoder, sleeps } = setup(SEETA, 200, { maxWaitMs: 2000 });
    await Promise.all([geocoder.search('a', 1), geocoder.search('b', 1)]);
    expect(sleeps).toEqual([1100]);
    // Reserve slots far ahead without letting time pass
    const busy = setup(SEETA, 200, { maxWaitMs: 2000, sleep: () => new Promise(() => undefined) });
    void busy.geocoder.search('a', 1); // starts now
    void busy.geocoder.search('b', 1); // would start in 1.1 s
    await expect(busy.geocoder.search('c', 1)).rejects.toBeInstanceOf(ProviderUnavailableError); // 2.2 s > 2 s
  });

  it('reports errors and odd responses as provider unavailable', async () => {
    await expect(setup({}, 503).geocoder.search('Seeta', 5)).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(setup({ not: 'a list' }).geocoder.search('Seeta', 5)).rejects.toBeInstanceOf(ProviderUnavailableError);
    const down = new NominatimGeocoding({ baseUrl: 'https://x', userAgent: 'ua', fetchImpl: () => Promise.reject(new Error('ENOTFOUND')) });
    await expect(down.search('Seeta', 5)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('MockGeocoding', () => {
  it('finds one labelled test place near Mukono, the same spot for the same query', async () => {
    const mock = new MockGeocoding();
    const [a] = await mock.search('seeta market', 5);
    const [b] = await mock.search('Seeta  Market', 5);
    expect(a?.name).toBe('Seeta Market');
    expect(a?.context).toMatch(/mock/i);
    expect(b).toEqual(a);
    expect(Math.abs((a?.lat ?? 0) - 0.353)).toBeLessThan(0.1);
  });
});
