import type { Page } from '@playwright/test';

export const WIDTHS = { mobile: { width: 375, height: 812 }, desktop: { width: 1280, height: 800 } } as const;

/** Saves the page at both review widths into docs/screenshots/<phase>/<name>-<width>.png. */
export const shoot = async (page: Page, phase: string, name: string, prepare?: (page: Page) => Promise<void>) => {
  for (const [label, size] of Object.entries(WIDTHS)) {
    await page.setViewportSize(size);
    if (prepare) await prepare(page);
    // Not 'networkidle': the service worker keeps precaching the app shell in the background
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `docs/screenshots/${phase}/${name}-${label}.png`, fullPage: true });
  }
};
