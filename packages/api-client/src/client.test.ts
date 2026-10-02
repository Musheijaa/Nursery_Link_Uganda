import { describe, expect, it } from 'vitest';
import { createApiClient, unwrap } from './client.js';
import { ApiError } from './errors.js';

const tokens = (n: number) => ({
  access_token: `access-${String(n)}`,
  token_type: 'Bearer' as const,
  expires_in: 900,
  user: { id: '00000000-0000-4000-8000-000000000001', full_name: 'Nakato', phone: '+256772123456', email: null, role: 'buyer' as const, phone_verified: true, created_at: '2026-09-30T10:00:00.000Z' },
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** A scripted API: `handler` sees each request; requests are recorded. */
const fakeApi = (handler: (req: Request, body: string) => Response | Promise<Response>) => {
  const seen: { url: string; auth: string | null; body: string }[] = [];
  const fetchImpl = (async (input: Request) => {
    const body = input.method === 'GET' ? '' : await input.clone().text();
    seen.push({ url: new URL(input.url).pathname, auth: input.headers.get('authorization'), body });
    return handler(input, body);
  }) as typeof fetch;
  return { fetchImpl, seen };
};

describe('unwrap', () => {
  it('returns data and meta, when the server made it, and whether it came from the offline cache', async () => {
    const { fetchImpl } = fakeApi(() =>
      json(200, { data: [{ id: 'x' }], meta: { page: 1, limit: 20, total: 1 } }, { date: 'Wed, 30 Sep 2026 10:00:00 GMT', 'x-from-cache': '1' })
    );
    const { client } = createApiClient({ baseUrl: 'http://api.test', fetch: fetchImpl });
    const result = await unwrap(client.GET('/news', { params: { query: {} } }));
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(result.fromCache).toBe(true);
    expect(result.fetchedAt?.toISOString()).toBe('2026-09-30T10:00:00.000Z');
  });

  it("turns the API's error envelope into an ApiError with field errors", async () => {
    const { fetchImpl } = fakeApi(() =>
      json(400, { error: { code: 'validation_error', message: 'The request is not valid', details: [{ path: ['phone'], message: 'Enter a Ugandan mobile number' }] } })
    );
    const { client } = createApiClient({ baseUrl: 'http://api.test', fetch: fetchImpl });
    const error = await unwrap(client.POST('/auth/login', { body: { identifier: 'x', password: 'y' } })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'validation_error', status: 400 });
    expect((error as ApiError).fieldErrors()).toEqual({ phone: 'Enter a Ugandan mobile number' });
  });

  it('gives up on a request that never answers, as network_error', async () => {
    const hang = ((req: Request) =>
      new Promise<Response>((_resolve, reject) => {
        req.signal.addEventListener('abort', () => { reject(new DOMException('Aborted', 'AbortError')); });
      })) as typeof fetch;
    const { client } = createApiClient({ baseUrl: 'http://api.test', fetch: hang, timeoutMs: 50 });
    await expect(unwrap(client.GET('/news', {}))).rejects.toMatchObject({ code: 'network_error', message: 'The connection is too slow right now. Try again in a moment.' });
  });

  it('reports a failed connection as network_error', async () => {
    const { client } = createApiClient({ baseUrl: 'http://api.test', fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(unwrap(client.GET('/news', {}))).rejects.toMatchObject({ code: 'network_error', isOffline: true });
  });
});

describe('silent refresh', () => {
  it('refreshes once for a burst of 401s, then replays each request (with its body) using the new token', async () => {
    let refreshes = 0;
    const { fetchImpl, seen } = fakeApi(req => {
      const path = new URL(req.url).pathname;
      if (path === '/api/v1/auth/refresh') {
        refreshes += 1;
        return json(200, { data: tokens(2) });
      }
      if (req.headers.get('authorization') !== 'Bearer access-2') return json(401, { error: { code: 'unauthorized', message: 'Your session has expired' } });
      return json(200, { data: { ok: path } });
    });
    const { client, session } = createApiClient({ baseUrl: 'http://api.test', fetch: fetchImpl });
    session.signIn(tokens(1));

    const [a, b] = await Promise.all([
      unwrap(client.GET('/orders/me', { params: { query: {} } })),
      unwrap(client.POST('/orders/quote', { body: { nursery_id: '00000000-0000-4000-8000-000000000002', items: [{ inventory_id: '00000000-0000-4000-8000-000000000003', quantity: 2 }], delivery_type: 'self_pickup' } })),
    ]);
    expect(refreshes).toBe(1);
    expect(a.data).toEqual({ ok: '/api/v1/orders/me' });
    expect(b.data).toEqual({ ok: '/api/v1/orders/quote' });
    const replayedQuote = seen.filter(s => s.url === '/api/v1/orders/quote').at(-1);
    expect(replayedQuote?.auth).toBe('Bearer access-2');
    expect(JSON.parse(replayedQuote?.body ?? '{}')).toMatchObject({ delivery_type: 'self_pickup' });
    expect(session.snapshot.user?.full_name).toBe('Nakato');
  });

  it('signs out when the refresh cookie is no longer valid', async () => {
    const { fetchImpl } = fakeApi(req =>
      new URL(req.url).pathname.endsWith('/auth/refresh')
        ? json(401, { error: { code: 'unauthorized', message: 'Your session has ended' } })
        : json(401, { error: { code: 'unauthorized', message: 'Your session has expired' } })
    );
    const { client, session } = createApiClient({ baseUrl: 'http://api.test', fetch: fetchImpl });
    session.signIn(tokens(1));
    const states: (string | null)[] = [];
    session.subscribe(s => states.push(s.user?.id ?? null));
    await expect(unwrap(client.GET('/auth/me', {}))).rejects.toMatchObject({ code: 'unauthorized', status: 401 });
    expect(session.token).toBeNull();
    expect(states).toEqual([null]);
  });

  it('never retries sign-in itself, and visitors (no token) are not refreshed', async () => {
    let refreshes = 0;
    const { fetchImpl } = fakeApi(req => {
      if (new URL(req.url).pathname.endsWith('/auth/refresh')) refreshes += 1;
      return json(401, { error: { code: 'unauthorized', message: 'Phone number, email or password is not correct' } });
    });
    const { client } = createApiClient({ baseUrl: 'http://api.test', fetch: fetchImpl });
    await expect(unwrap(client.POST('/auth/login', { body: { identifier: 'a', password: 'b' } }))).rejects.toMatchObject({ status: 401 });
    await expect(unwrap(client.GET('/auth/me', {}))).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(0);
  });
});
