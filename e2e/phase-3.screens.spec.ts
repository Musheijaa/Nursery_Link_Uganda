import { expect, test, type Page } from '@playwright/test';

const DIR = 'docs/screenshots/phase-3';
// A buyer standing in Mukono town
test.use({ geolocation: { latitude: 0.3533, longitude: 32.7553 }, permissions: ['geolocation'] });

const settle = async (page: Page) => {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200); // tiles and fly-to animations
};

test.describe('phase 3: /nurseries', () => {
  test('desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/nurseries');
    await expect(page.getByRole('heading', { name: '15 nurseries' })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/nurseries-desktop.png` });

    // Search a tree, then sort by nearest (asks for the location first, with a reason)
    await page.getByLabel('Search a tree or nursery').fill('Mvule');
    await expect(page.getByRole('heading', { name: /^\d+ nurser/ })).not.toHaveText('15 nurseries');
    // Close the suggestions, as a person would before moving on to the filters
    await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible();
    await page.getByLabel('Search a tree or nursery').press('Escape');
    await page.getByRole('button', { name: 'Sort by nearest' }).click();
    await expect(page.getByRole('dialog', { name: 'Use your location?' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/location-ask-desktop.png` });
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByRole('heading', { name: 'Nearest first, by road distance' })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/nearest-mvule-desktop.png` });

    // Open the nearest nursery, then a tree's Library entry, then directions
    await page.getByRole('list').getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'In stock' })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/card-desktop.png` });
    await page.getByRole('button', { name: /^Mvule: About Mvule/ }).click();
    await expect(page.getByText('Milicia excelsa')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/species-drawer-desktop.png` });
    await page.getByRole('button', { name: 'Close tree details' }).click();
    await page.getByRole('button', { name: 'Get directions' }).click();
    await expect(page.getByRole('list', { name: 'Steps' })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/directions-desktop.png` });
  });

  test('district filter highlights its boundary', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/nurseries');
    await page.getByLabel('District').selectOption({ label: 'Mukono' });
    await page.getByLabel('Sub-county').selectOption({ label: 'Ntenjeru' });
    await settle(page);
    await page.screenshot({ path: `${DIR}/subcounty-filter-desktop.png` });
  });

  test('mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/nurseries');
    await settle(page);
    await page.screenshot({ path: `${DIR}/nurseries-map-mobile.png` });
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await settle(page);
    await page.screenshot({ path: `${DIR}/nurseries-list-mobile.png`, fullPage: true });
    await page.getByRole('list').getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'In stock' })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/card-mobile.png` });
  });

  test('deep link from the Library (FR-20)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/nurseries?species=mvule&sort=nearest&view=list');
    await expect(page.getByRole('dialog', { name: 'Use your location?' })).toBeVisible();
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByRole('heading', { name: 'Nearest first, by road distance' })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/deeplink-species-nearest-mobile.png`, fullPage: true });
  });
});
