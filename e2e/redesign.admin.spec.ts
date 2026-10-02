import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { ADMIN_URL, E2E_DATABASE_URL } from './env';
import { adminPage, settle } from './helpers';
import { shoot } from './screens';

/** The admin console in the "Earth & canopy" look, with a year of demo activity behind Insights. */
const DIR = 'redesign';

test.describe('admin redesign screens', () => {
  test.beforeAll(() => {
    // Invented activity (dev and E2E databases only): see apps/api/src/db/demoActivity.ts
    execSync('pnpm --filter @nurserylink/api db:demo-activity', { stdio: 'ignore', env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL } });
  });

  test('sign-in, dashboard, insights, tables', async ({ browser, page }) => {
    test.setTimeout(240_000);
    await shoot(page, DIR, 'admin-login', async p => {
      await p.goto(`${ADMIN_URL}/login`);
      await expect(p.getByRole('heading', { name: 'Sign in' })).toBeVisible();
      await settle(p, 500);
    });

    const admin = await adminPage(browser);
    await shoot(admin, DIR, 'admin-dashboard', async p => { await p.goto('/'); await expect(p.getByText(/^Oli otya/)).toBeVisible(); await settle(p, 400); });
    await shoot(admin, DIR, 'admin-insights', async p => {
      await p.goto('/insights');
      await expect(p.getByRole('heading', { name: 'Sales over time' })).toBeVisible();
      await settle(p, 800);
    });
    await shoot(admin, DIR, 'admin-insights-year', async p => {
      await p.goto('/insights?range=12m');
      await expect(p.getByRole('button', { name: 'Last 12 months' })).toHaveAttribute('aria-pressed', 'true');
      await settle(p, 800);
    });
    await shoot(admin, DIR, 'admin-orders', async p => { await p.goto('/orders'); await expect(p.getByRole('heading', { name: 'Orders' })).toBeVisible(); await settle(p, 400); });
    await admin.context().close();
  });
});
