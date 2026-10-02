import createClient, { type Middleware } from 'openapi-fetch';
import { ApiError, toApiError } from './errors.js';
import type { paths } from './schema.js';
import { Session, type AuthTokens } from './session.js';

export interface ApiClientOptions {
  /** API origin, e.g. "https://api.example.ug"; empty for same-origin (dev proxy) */
  baseUrl: string;
  fetch?: typeof fetch;
  /** Give up on a request that hasn't answered after this long (default 20 s) */
  timeoutMs?: number;
}

/** Header the service worker adds when it answers from its cache because the network failed. */
export const FROM_CACHE_HEADER = 'x-from-cache';

// Auth endpoints that must never trigger a refresh-and-retry
const NO_RETRY = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/verify', '/api/v1/auth/logout'];

/**
 * The typed API client both apps use: openapi-fetch over the generated `paths`, plus
 *  - the access token on every request, and one shared silent refresh + retry on a 401;
 *  - credentials included, so the httpOnly refresh cookie reaches /auth/refresh;
 *  - network failures turned into ApiError('network_error').
 */
export const createApiClient = ({ baseUrl, fetch: customFetch, timeoutMs = 20_000 }: ApiClientOptions) => {
  // Looked up on every call, so test tools and polyfills that patch fetch later still apply
  const fetchImpl = (request: Request) => (customFetch ?? globalThis.fetch)(request);
  const root = `${baseUrl.replace(/\/$/, '')}/api/v1`;

  /**
   * Sends a request, giving up after `timeoutMs`: on a weak signal a request can hang with no
   * answer, and the screen should offer "Try again" rather than load forever.
   */
  const send = async (request: Request): Promise<Response> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tooSlow = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new ApiError('network_error', 'The connection is too slow right now. Try again in a moment.', 0, { timeoutMs }));
      }, timeoutMs);
    });
    try {
      return await Promise.race([fetchImpl(request), tooSlow]);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('network_error', 'No connection. Check your data or Wi-Fi and try again.', 0, { cause: String(err) });
    } finally {
      clearTimeout(timer);
    }
  };

  const session = new Session(async () => {
    const res = await send(new Request(`${root}/auth/refresh`, { method: 'POST', credentials: 'include' }));
    if (!res.ok) return null;
    return ((await res.json()) as { data: AuthTokens }).data;
  });

  const retries = new WeakMap<Request, Request>();
  const auth: Middleware = {
    onRequest({ request }) {
      const token = session.token;
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      // Keep an unread copy, in case the request has to be replayed after a refresh
      retries.set(request, request.clone());
      return request;
    },
    async onResponse({ request, response }) {
      const path = new URL(request.url).pathname;
      if (response.status !== 401 || NO_RETRY.some(p => path.endsWith(p))) return response;
      const replay = retries.get(request);
      const hadToken = request.headers.has('Authorization');
      if (!replay || !hadToken) return response;
      const token = await session.refresh();
      if (!token) return response;
      replay.headers.set('Authorization', `Bearer ${token}`);
      return send(replay);
    },
  };

  const client = createClient<paths>({ baseUrl: root, credentials: 'include', fetch: send });
  client.use(auth);
  return { client, session };
};

export type ApiClient = ReturnType<typeof createApiClient>['client'];

type Envelope = { data: unknown; meta?: unknown };

export interface Result<E extends Envelope> {
  data: E['data'];
  meta: E['meta'];
  /** Served by the service worker from its cache because the network failed */
  fromCache: boolean;
  /** When the server produced this response (its Date header), for "Last updated …" */
  fetchedAt: Date | null;
}

/**
 * Unwraps an openapi-fetch call: resolves to the envelope's data and meta, or rejects with an
 * ApiError carrying the API's code, message and details.
 */
export async function unwrap<E extends Envelope>(call: Promise<{ data?: E; error?: unknown; response: Response }>): Promise<Result<E>> {
  const { data, error, response } = await call;
  if (!response.ok || data === undefined) throw toApiError(response.status, error);
  const date = response.headers.get('date');
  return {
    data: data.data,
    meta: data.meta,
    fromCache: response.headers.get(FROM_CACHE_HEADER) === '1',
    fetchedAt: date ? new Date(date) : null,
  };
}

/** For 204 responses: resolves when the call succeeded. */
export async function expectOk(call: Promise<{ error?: unknown; response: Response }>): Promise<void> {
  const { error, response } = await call;
  if (!response.ok) throw toApiError(response.status, error);
}
