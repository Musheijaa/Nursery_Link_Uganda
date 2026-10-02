import { expect, test } from '@playwright/test';
import { shoot } from './screens';
import { ADMIN_URL } from './env';

const PHASE = 'phase-2';

test.describe('phase 2 screens', () => {
  test('public site', async ({ page }) => {
    const visit = (path: string) => async () => { await page.goto(path); };
    await shoot(page, PHASE, 'web-home', visit('/'));
    await shoot(page, PHASE, 'web-register', visit('/register'));
    await shoot(page, PHASE, 'web-verify', visit('/verify?phone=%2B256772123456'));
    await shoot(page, PHASE, 'web-login', visit('/login'));
    await shoot(page, PHASE, 'web-forgot', visit('/forgot-password'));
    await shoot(page, PHASE, 'web-reset-code', visit('/reset-password?phone=%2B256772123456'));
    await shoot(page, PHASE, 'web-404', visit('/no-such-page'));
    await shoot(page, PHASE, 'web-credits', visit('/credits'));

    // Validation errors shown next to the fields
    await shoot(page, PHASE, 'web-register-errors', async p => {
      await p.goto('/register');
      await p.getByLabel('Full name').fill('N');
      await p.getByLabel(/Phone number/).fill('12345');
      await p.getByRole('button', { name: 'Create account' }).click();
      await expect(p.getByText('Enter a Ugandan mobile number, e.g. 0772 123 456')).toBeVisible();
    });

    // Mobile menu
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.waitForTimeout(400); // let the slide-in finish
    await page.screenshot({ path: `docs/screenshots/${PHASE}/web-menu-mobile.png` });
    await page.keyboard.press('Escape');

    // Offline banner
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.screenshot({ path: `docs/screenshots/${PHASE}/web-offline-mobile.png` });
    await page.context().setOffline(false);
  });

  test('admin console', async ({ page }) => {
    const admin = ADMIN_URL;
    await shoot(page, PHASE, 'admin-login', async p => { await p.goto(`${admin}/login`); });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${admin}/login`);
    await page.getByLabel('Phone number or email').fill(process.env.ADMIN_PHONE ?? '');
    await page.getByLabel('Password').fill(process.env.ADMIN_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/${PHASE}/admin-shell-desktop.png` });
  });
});
