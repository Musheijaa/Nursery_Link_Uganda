import { describe, expect, it } from 'vitest';
import { ProviderUnavailableError } from '../../lib/errors.js';
import { haversineKm, polarSamples, type LatLng } from '../../lib/geo.js';
import { MockRouting } from './mockRouting.js';
import { OsrmRouting, describeManeuver } from './osrm.js';

const from = { lat: 0.3533, lng: 32.7553 };
const to = { lat: 0.2, lng: 32.8 };

/** A fetch that returns a canned response and records the requested URL. */
const fakeFetch = (status: number, body: unknown, calls: string[] = []) =>
  ((url: string) => {
    calls.push(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  }) as typeof fetch;

const step = (type: string, name: string, distance: number, modifier?: string) => ({
  name, distance, duration: distance / 10, maneuver: { type, ...(modifier ? { modifier } : {}) },
});

describe('OsrmRouting.route', () => {
  it('parses distance, duration, geometry and readable steps', async () => {
    const calls: string[] = [];
    const osrm = new OsrmRouting('http://osrm:5000/', fakeFetch(200, {
      code: 'Ok',
      routes: [{
        distance: 23456,
        duration: 2400,
        geometry: { type: 'LineString', coordinates: [[32.7553, 0.3533], [32.78, 0.3], [32.8, 0.2]] },
        legs: [{ steps: [
          step('depart', 'Kampala–Jinja Road', 12000),
          step('turn', 'Katosi Road', 11456, 'right'),
          step('arrive', '', 0),
        ] }],
      }],
    }, calls));

    const route = await osrm.route(from, to);
    expect(calls[0]).toBe('http://osrm:5000/route/v1/driving/32.7553,0.3533;32.8,0.2?overview=full&geometries=geojson&steps=true');
    expect(route).toMatchObject({ distanceKm: 23.46, durationMin: 40, geometry: { type: 'LineString' } });
    expect(route.steps.map(s => s.instruction)).toEqual(['Start on Kampala–Jinja Road', 'Turn right onto Katosi Road', 'Arrive at the nursery']);
    expect(route.steps[1]).toMatchObject({ road: 'Katosi Road', distance_m: 11456 });
  });

  it('reports NoRoute and network failures as ProviderUnavailableError', async () => {
    await expect(new OsrmRouting('http://osrm', fakeFetch(400, { code: 'NoRoute', message: 'Impossible route' })).route(from, to))
      .rejects.toBeInstanceOf(ProviderUnavailableError);
    const down = (() => Promise.reject(new Error('ECONNREFUSED'))) as typeof fetch;
    await expect(new OsrmRouting('http://osrm', down).route(from, to)).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(new OsrmRouting('http://osrm', fakeFetch(502, 'Bad gateway')).route(from, to)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('OsrmRouting.table', () => {
  it('returns kilometres per destination and null for unreachable ones', async () => {
    const calls: string[] = [];
    const osrm = new OsrmRouting('http://osrm', fakeFetch(200, { code: 'Ok', distances: [[0, 5250, null, 12999]] }, calls));
    const km = await osrm.table(from, [to, { lat: 0.06, lng: 32.83 }, { lat: 0.5, lng: 32.9 }]);
    expect(km).toEqual([5.25, null, 13]);
    expect(calls[0]).toContain('/table/v1/driving/32.7553,0.3533;32.8,0.2;32.83,0.06;32.9,0.5?sources=0&annotations=distance');
  });

  it('skips the request when there are no destinations', async () => {
    const calls: string[] = [];
    expect(await new OsrmRouting('http://osrm', fakeFetch(200, {}, calls)).table(from, [])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('describeManeuver', () => {
  it.each([
    [step('turn', 'Main Street', 1, 'slight left'), 'Turn slight left onto Main Street'],
    [step('new name', '', 1, 'straight'), 'Continue'],
    [step('roundabout', 'Seeta Road', 1), 'Take the roundabout towards Seeta Road'],
    [step('fork', 'Mukono Road', 1, 'slight right'), 'Keep right at the fork onto Mukono Road'],
    [step('turn', '', 1, 'uturn'), 'Make a U-turn'],
  ])('describes %j', (s, expected) => {
    expect(describeManeuver(s)).toBe(expected);
  });
});

describe('OsrmRouting.isochrone', () => {
  /**
   * A fake OSRM table service: road distance is 1.5 × straight line, points south of latitude 0.30
   * are "in the lake" (snapped 3 km away), and it refuses more than 100 coordinates per request.
   */
  const fakeTable = (calls: string[]) =>
    ((url: string) => {
      calls.push(url);
      const coords = /driving\/([^?]+)/.exec(url)?.[1]?.split(';').map(c => c.split(',').map(Number)) ?? [];
      if (coords.length > 100) return Promise.resolve(new Response(JSON.stringify({ code: 'TooBig' }), { status: 400 }));
      const points: LatLng[] = coords.map(([lng, lat]) => ({ lat: lat ?? 0, lng: lng ?? 0 }));
      const [origin] = points;
      const body = {
        code: 'Ok',
        distances: [points.map(p => (origin ? haversineKm(origin, p) * 1500 : 0))],
        destinations: points.map(p => ({ distance: p.lat < 0.3 ? 3000 : 5 })),
      };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }) as typeof fetch;

  it('keeps points within each distance by road, batched under the table limit, and drops off-road points', async () => {
    const calls: string[] = [];
    const origin = { lat: 0.35, lng: 32.75 };
    const [five, twenty] = await new OsrmRouting('http://osrm', fakeTable(calls)).isochrone(origin, [5, 20]);
    const samples = polarSamples(origin, 20);
    expect(calls).toHaveLength(Math.ceil(samples.length / 99));
    expect(five?.points[0]).toEqual(origin);
    // Road = 1.5 × straight, so 5 km by road reaches 3.33 km out
    const furthest = (pts: LatLng[]) => Math.max(...pts.map(p => haversineKm(origin, p)));
    expect(furthest(five?.points ?? [])).toBeLessThanOrEqual(5 / 1.5 + 1e-9);
    expect(furthest(five?.points ?? [])).toBeGreaterThan(2.9);
    expect(twenty?.points.every(p => p.lat >= 0.3)).toBe(true);
    expect(twenty?.points.length).toBeGreaterThan(five?.points.length ?? 0);
  });

  it('fails loudly when the routing service fails', async () => {
    await expect(new OsrmRouting('http://osrm', fakeFetch(200, { code: 'NoTable' })).isochrone(from, [5])).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('MockRouting', () => {
  it('reaches km ÷ 1.3 in a straight line in every direction', async () => {
    const [ten] = await new MockRouting().isochrone(from, [10]);
    const distances = (ten?.points ?? []).map(p => haversineKm(from, p));
    expect(Math.max(...distances)).toBeLessThanOrEqual(10 / 1.3 + 1e-9);
    expect(Math.max(...distances)).toBeGreaterThan(7);
  });

  it('uses straight-line distance × 1.3', async () => {
    const [km] = await new MockRouting().table(from, [to]);
    const route = await new MockRouting().route(from, to);
    expect(km).toBe(route.distanceKm);
    expect(route.distanceKm).toBeGreaterThan(17);
    expect(route.distanceKm).toBeLessThan(24);
  });
});
