/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import type { WorkboxPlugin } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

// The app shell: built JS, CSS, fonts and index.html
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Every page loads the app shell, so deep links work offline too (never for API calls)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

const DAY = 24 * 60 * 60;

/**
 * Marks responses served from the cache (because the network failed or was too slow), so the
 * app can show "Offline · Last updated …" instead of pretending the data is live.
 */
const markFromCache: WorkboxPlugin = {
  cachedResponseWillBeUsed: async ({ cachedResponse }) => {
    if (!cachedResponse) return null;
    const headers = new Headers(cachedResponse.headers);
    headers.set('x-from-cache', '1');
    return new Response(await cachedResponse.blob(), { status: cachedResponse.status, statusText: cachedResponse.statusText, headers });
  },
};

// Public catalogue data only. Never auth, orders, applications or admin: those are personal.
const PUBLIC_API = /^\/api\/v1\/(nurseries|species|boundaries|news|campaigns|stats)(\/|$|\?)/;
const PRIVATE = /\/applications\//;

registerRoute(
  ({ url, request }) => request.method === 'GET' && PUBLIC_API.test(url.pathname) && !PRIVATE.test(url.pathname),
  new NetworkFirst({
    cacheName: 'api-public',
    // On a slow connection, show the saved copy after 4 s rather than an endless spinner
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 14 * DAY, purgeOnQuotaError: true }),
      markFromCache,
    ],
  })
);

// Map tiles the user has already looked at (no prefetching, per the OSM tile usage policy).
// Tiles are fetched with CORS, so cached copies are real responses rather than padded opaque ones.
registerRoute(
  ({ request, url }) => request.destination === 'image' && /\/\d+\/\d+\/\d+\.png$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'map-tiles',
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true })],
  })
);

// Photos (species, campaigns): small WebP files, kept after the first view
registerRoute(
  ({ url }) => url.pathname.startsWith('/images/') || url.pathname.startsWith('/media/'),
  new CacheFirst({
    cacheName: 'images',
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true })],
  })
);

self.addEventListener('message', event => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
