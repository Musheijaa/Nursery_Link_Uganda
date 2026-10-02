import { expect, test } from '@playwright/test';
import { WEB_URL } from './env';
import { settle } from './helpers';
import { netSwitch } from './netswitch';

const DIR = 'docs/screenshots/phase-9';

/** Brief journey 8: load /nurseries, go offline, reload, and the cached list still renders (SRS 2.6). */
test('offline: /nurseries still shows the list from the cache after a reload', async ({ browser }) => {
  const net = await netSwitch();
  const context = await browser.newContext({ baseURL: WEB_URL, proxy: net.proxy, viewport: { width: 375, height: 812 }, locale: 'en-UG', timezoneId: 'Africa/Kampala' });
  try {
    const page = await context.newPage();
    await page.goto('/nurseries?view=list');
    await expect(page.getByRole('heading', { name: '15 nurseries' })).toBeVisible();

    // The service worker controls pages from the next load on, and caches only what it handles:
    // wait for it to install, then load once more online so the list goes through it
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect(page.getByRole('heading', { name: '15 nurseries' })).toBeVisible();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    // The connection drops (for the page and the service worker), and the buyer reloads
    net.setOnline(false);
    await page.reload();
    await expect(page.getByRole('heading', { name: '15 nurseries' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('list').getByRole('button', { name: /Mukono Town Nursery/ })).toBeVisible();
    await expect(page.getByText(/^Offline · Last updated /).first()).toBeVisible();
    await settle(page, 300);
    await page.screenshot({ path: `${DIR}/offline-nurseries-mobile.png`, fullPage: true });

    // Back online, the list is live again
    net.setOnline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: '15 nurseries' })).toBeVisible();
    await expect(page.getByText(/^Offline · Last updated /)).toHaveCount(0);
  } finally {
    await context.close();
    await net.close();
  }
});
