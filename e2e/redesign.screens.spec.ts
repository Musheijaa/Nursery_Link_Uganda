import { expect, test } from '@playwright/test';
import { shoot } from './screens';

/** The "Earth & canopy" redesign of the public site, page by page, at 375 and 1280 px. */
const DIR = 'redesign';
const PAGES = (process.env.SHOTS ?? 'home').split(',');

test.describe('redesign screens', () => {
  test('pages', async ({ page }) => {
    test.setTimeout(300_000);
    const species = (await (await page.request.get('/api/v1/species?q=Mvule')).json()) as { data: { slug: string }[] };
    const news = (await (await page.request.get('/api/v1/news?limit=1')).json()) as { data: { slug: string }[] };
    const campaigns = (await (await page.request.get('/api/v1/campaigns?limit=1')).json()) as { data: { id: string }[] };
    const all: Record<string, string> = {
      home: '/',
      nurseries: '/nurseries?view=list',
      map: '/nurseries',
      library: '/library',
      species: `/library/${species.data[0]?.slug ?? ''}`,
      news: '/news',
      article: `/news/${news.data[0]?.slug ?? ''}`,
      free: '/free-seedlings',
      campaign: `/free-seedlings/${campaigns.data[0]?.id ?? ''}`,
      login: '/login',
      register: '/register',
      notfound: '/no-such-page',
    };
    for (const name of PAGES) {
      const path = all[name];
      if (!path) continue;
      await shoot(page, DIR, name, async p => {
        await p.goto(path);
        await expect(p.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await p.waitForTimeout(800);
      });
    }
  });
});
