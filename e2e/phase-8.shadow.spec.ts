import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DATABASE_URL } from './env';
import { adminPage, settle } from './helpers';

const DIR = 'docs/screenshots/phase-8';

/**
 * The journey needs forest-loss data. Load the synthetic development sample, but only when the
 * table is empty or already holds the sample: real data loaded with scripts/forest-loss is never replaced.
 */
const ensureLossData = async (page: Page) => {
  const login = await page.request.post('/api/v1/auth/login', { data: { identifier: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD } });
  const token = ((await login.json()) as { data: { access_token: string } }).data.access_token;
  const res = await page.request.get('/api/v1/admin/audit-log?action=forest_loss.load&limit=1', { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok()).toBe(true);
  const latest = ((await res.json()) as { data: { after: { sources?: string[] } | null }[] }).data[0];
  if (latest && !(latest.after?.sources ?? []).includes('synthetic_dev_sample')) return;
  execSync('pnpm --filter @nurserylink/api db:forest-sample', { stdio: 'ignore', env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL } });
};

test.describe('phase 8: Nursery Shadow', () => {
  test('run the analysis, read the zones, reuse the result, export', async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await adminPage(browser);
    await ensureLossData(page);

    // Odd settings, so this test starts a new run every time rather than reusing an old one
    const threshold = String(15 + Math.floor(Math.random() * 1000) / 100);
    await page.goto('/shadow');
    await expect(page.getByRole('heading', { name: 'Nursery Shadow', level: 1 })).toBeVisible();
    await expect(page.getByText('This is invented sample data for development')).toBeVisible();

    // Validation comes from the shared schema
    await page.getByLabel('Counting loss since').fill('1990');
    await page.getByRole('button', { name: 'Run analysis' }).click();
    await expect(page.getByText(/greater than or equal to 2001|2001/).first()).toBeVisible();

    await page.getByLabel('Forest lost (at least, %)').fill(threshold);
    await page.getByLabel('Counting loss since').fill('2010');
    await page.getByRole('button', { name: 'Run analysis' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Started.' })).toBeVisible();
    // The page switches to the new run (the URL names it), which works in the background, then shows its result
    await expect(page).toHaveURL(/[?&]run=[0-9a-f-]{36}/);
    const runId = new URL(page.url()).searchParams.get('run') ?? '';
    await expect(page.getByRole('button', { name: /since 2010 .* (Waiting|Running|Done)$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`^≥ ${threshold.replace('.', '\\.')}% since 2010 .* Done$`) })).toBeVisible({ timeout: 180_000 });
    expect(new URL(page.url()).searchParams.get('run')).toBe(runId);
    await expect(page.getByText(/shadow zones? · .* km² · 15 nurseries measured/)).toBeVisible();

    const zones = page.getByRole('region', { name: 'Shadow zones, largest first' }).or(page.locator('section', { has: page.getByRole('heading', { name: 'Shadow zones, largest first' }) }));
    const rows = zones.getByRole('row');
    await expect(rows.nth(1)).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(1);
    await rows.nth(1).getByRole('button', { name: 'Show on map' }).click();
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    await settle(page, 1500);
    await page.screenshot({ path: `${DIR}/shadow-desktop.png`, fullPage: true });

    // Service areas layer
    await page.getByLabel('Nursery reach (5, 10, 20 km by road)').check();
    await settle(page, 1500);
    await page.screenshot({ path: `${DIR}/shadow-reach-desktop.png`, fullPage: true });

    // Export
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download GeoJSON' }).click();
    expect((await download).suggestedFilename()).toMatch(/^nursery-shadow-[0-9a-f]{8}\.geojson$/);

    // Same settings, nothing changed: the earlier result is reused
    await page.getByRole('button', { name: 'Run analysis' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Nothing has changed since the last run' })).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await settle(page, 1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${DIR}/shadow-mobile.png`, fullPage: true });
    await page.context().close();
  });
});
