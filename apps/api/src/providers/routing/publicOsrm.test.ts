import { describe, expect, it } from 'vitest';
import { ProviderUnavailableError } from '../../lib/errors.js';
import { PublicOsrmDirections } from './publicOsrm.js';

const from = { lat: 0.3476, lng: 32.5825 };
const to = { lat: 0.3533, lng: 32.7553 };

const okBody = {
  code: 'Ok',
  routes: [{
    distance: 24757,
    duration: 1246,
    geometry: { type: 'LineString', coordinates: [[32.5825, 0.3476], [32.65, 0.34], [32.7553, 0.3533]] },
    legs: [{ steps: [
      { name: 'Jinja Road', distance: 24757, duration: 1246, maneuver: { type: 'depart' } },
      { name: '', distance: 0, duration: 0, maneuver: { type: 'arrive' } },
    ] }],
  }],
};

/** A fake clock and server: records each request and the time it was made. */
const setup = (status = 200, body: unknown = okBody) => {
  const clock = 1_000_000;
  const calls: { url: string; headers: Headers }[] = [];
  const waits: number[] = [];
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push({ url, headers: new Headers(init?.headers) });
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  }) as typeof fetch;
  const directions = new PublicOsrmDirections({
    baseUrl: 'https://routing.example/routed-car/',
    userAgent: 'NurseryLinkUganda/test (https://nurserylink.example)',
    fetchImpl,
    now: () => clock,
    // The clock stands still, so every wait is measured from the same moment
    sleep: ms => { waits.push(ms); return Promise.resolve(); },
  });
  return { directions, calls, waits };
};

describe('PublicOsrmDirections', () => {
  it('follows the roads, with an identifying User-Agent', async () => {
    const { directions, calls } = setup();
    const route = await directions.route(from, to);
    expect(calls[0]?.url).toBe('https://routing.example/routed-car/route/v1/driving/32.5825,0.3476;32.7553,0.3533?overview=full&geometries=geojson&steps=true');
    expect(calls[0]?.headers.get('user-agent')).toBe('NurseryLinkUganda/test (https://nurserylink.example)');
    expect(route.geometry.coordinates).toHaveLength(3);
    expect(route).toMatchObject({ distanceKm: 24.76, durationMin: 21 });
    expect(route.steps.map(s => s.instruction)).toEqual(['Start on Jinja Road', 'Arrive at the nursery']);
  });

  it('caches routes from (about) the same spot', async () => {
    const { directions, calls } = setup();
    await directions.route(from, to);
    await directions.route({ lat: from.lat + 0.00001, lng: from.lng }, to);
    expect(calls).toHaveLength(1);
  });

  it('spaces requests at least 1.1 s apart and refuses rather than queue for long', async () => {
    const { directions, calls, waits } = setup();
    await Promise.all([1, 2, 3, 4].map(i => directions.route({ lat: from.lat + i / 100, lng: from.lng }, to)));
    expect(calls).toHaveLength(4);
    expect(waits).toEqual([1100, 2200, 3300]);

    const busy = setup().directions;
    const attempts = await Promise.allSettled([0, 1, 2, 3, 4, 5].map(i => busy.route({ lat: from.lat + i / 100, lng: from.lng }, to)));
    // Waits of 0, 1.1, 2.2 and 3.3 s are fine; 4.4 s is over the 4 s limit
    expect(attempts.map(a => a.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled', 'rejected', 'rejected']);
    const refused = attempts[5];
    expect(refused?.status === 'rejected' ? refused.reason : null).toBeInstanceOf(ProviderUnavailableError);
  });

  it('tries once more after a passing server error, but not when there is no road', async () => {
    const down = setup(502, 'Bad gateway');
    await expect(down.directions.route(from, to)).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(down.calls).toHaveLength(2);
    expect(down.waits).toEqual([1100]);

    const noRoad = setup(400, { code: 'NoRoute', message: 'Impossible route between points' });
    await expect(noRoad.directions.route(from, to)).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(noRoad.calls).toHaveLength(1);
  });

  it('recovers when the second try succeeds', async () => {
    let n = 0;
    const fetchImpl = (() => {
      n += 1;
      return Promise.resolve(n === 1 ? new Response('busy', { status: 503 }) : Response.json(okBody));
    }) as typeof fetch;
    const directions = new PublicOsrmDirections({ baseUrl: 'https://routing.example', userAgent: 'test', fetchImpl, sleep: () => Promise.resolve() });
    await expect(directions.route(from, to)).resolves.toMatchObject({ distanceKm: 24.76 });
  });
});
