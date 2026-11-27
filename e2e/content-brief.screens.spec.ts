import { expect, test, type Page } from '@playwright/test';
import { adminPage, settle } from './helpers';

/**
 * Every page the client content brief changed, at 360 px and 1280 px (the brief's "send me screenshots").
 * Saved to docs/screenshots/content-brief/<name>-<360|1280>.png. Maps show their "map unavailable" note
 * here: the suite runs without a Google Maps key.
 */
const DIR = 'docs/screenshots/content-brief';
const WIDTHS = [{ width: 360, height: 760 }, { width: 1280, height: 800 }] as const;

const shoot = async (page: Page, name: string, prepare: (p: Page) => Promise<void>) => {
  for (const size of WIDTHS) {
    await page.setViewportSize(size);
    await prepare(page);
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 400);
    await page.screenshot({ path: `${DIR}/${name}-${String(size.width)}.png`, fullPage: true });
  }
};

const heading = (p: Page, name: string | RegExp) => expect(p.getByRole('heading', { name }).first()).toBeVisible();

test.describe('content brief screens', () => {
  test('public site', async ({ page }) => {
    test.setTimeout(240_000);
    const giveaways = (await (await page.request.get('/api/v1/giveaways?limit=1')).json()) as { data: { id: string }[] };
    const pages: [string, string, string | RegExp][] = [
      ['home', '/', 'Welcome to Nursery Link Uganda!'],
      ['find-nurseries', '/nurseries?view=list', 'Find Nurseries'],
      ['find-nurseries-filtered', '/nurseries?view=list&certified=false&categories=fruit,shade', 'Find Nurseries'],
      ['tree-library', '/library', 'WELCOME TO THE DIGITAL TREE LIBRARY'],
      ['tree-mvule', '/library/mvule', 'Mvule'],
      ['expert-services', '/expert-services', 'WELCOME TO EXPERT SERVICES'],
      ['news', '/news', 'WELCOME TO NEWS & UPDATES'],
      ['giveaways', '/giveaways', 'DISCOVER FREE AND SUBSIDISED SEEDLING OPPORTUNITIES ACROSS UGANDA'],
      ['giveaway', `/giveaways/${giveaways.data[0]?.id ?? ''}`, /./],
      ['donate', '/donate', 'SUPPORT NURSERY LINK UGANDA'],
      ['search', '/search?q=mvule', 'Search'],
    ];
    for (const [name, path, title] of pages) await shoot(page, name, async p => { await p.goto(path); await heading(p, title); });

    await shoot(page, 'nursery-card', async p => {
      await p.goto('/nurseries?view=list&q=Mukono%20Town');
      await p.getByRole('main').getByRole('list').getByRole('button', { name: /Mukono Town Nursery/ }).click();
      await heading(p, 'In stock');
    });
    await page.setViewportSize(WIDTHS[0]);
    await page.goto('/');
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settle(page, 400);
    await page.screenshot({ path: `${DIR}/more-menu-360.png` });
  });

  test('admin console', async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await adminPage(browser);
    const screens: [string, string, string][] = [
      ['admin-inbox', '/inbox?status=all', 'Inbox'],
      ['admin-categories', '/categories', 'Categories'],
      ['admin-expert-services', '/expert-services', 'Expert Services'],
      ['admin-partners', '/partners', 'Partners'],
      ['admin-page-content', '/page-content', 'Page content'],
      ['admin-giveaways', '/giveaways', 'Giveaways'],
      ['admin-giveaway-new', '/giveaways/new', 'New giveaway'],
      ['admin-tree-new', '/species/new', 'Add a tree'],
    ];
    for (const [name, path, title] of screens) await shoot(admin, name, async p => { await p.goto(path); await heading(p, title); });
    await admin.context().close();
  });
});
