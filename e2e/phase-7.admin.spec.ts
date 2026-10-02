import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { adminPage, lastSms, randomMtnPhone, settle, settlePayment, toE164 } from './helpers';
import { shoot } from './screens';

const PHASE = 'phase-7';
const DIR = `docs/screenshots/${PHASE}`;
const PASSWORD = 'seedlings-2026';

/** A verified buyer created through the API (the screens are covered in phases 2–6). */
const apiBuyer = async (request: APIRequestContext, name: string) => {
  const local = randomMtnPhone();
  const phone = toE164(local);
  expect((await request.post('/api/v1/auth/register', { data: { full_name: name, phone: local, password: PASSWORD } })).ok()).toBe(true);
  const res = await request.get(`/api/v1/dev/sms-outbox?to=${encodeURIComponent(phone)}`);
  const code = /(\d{6})/.exec(((await res.json()) as { data: { message: string }[] }).data[0]?.message ?? '')?.[1] ?? '';
  const verified = await request.post('/api/v1/auth/verify', { data: { phone: local, code } });
  expect(verified.ok()).toBe(true);
  const token = ((await verified.json()) as { data: { access_token: string } }).data.access_token;
  return { local, phone, auth: { Authorization: `Bearer ${token}` } };
};

test.describe('phase 7: admin console', () => {
  test('screens', async ({ browser }) => {
    const page = await adminPage(browser);
    const shot = (name: string, go: (p: Page) => Promise<void>) => shoot(page, PHASE, name, go);

    await shot('dashboard', async p => { await p.goto('/'); await expect(p.getByRole('heading', { name: 'Needs attention' })).toBeVisible(); await settle(p, 300); });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/menu-mobile.png` });
    await page.getByRole('link', { name: 'Nurseries' }).click();
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
    await shot('nurseries', async p => { await p.goto('/nurseries?q=Mukono'); await expect(p.getByRole('link', { name: 'Mukono Town Nursery' })).toBeVisible(); });

    // Nursery form: placing the pin on the map sets the location; the API derives the sub-county
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/nurseries?q=Mukono');
    await page.getByRole('link', { name: 'Mukono Town Nursery' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Mukono Town Nursery' })).toBeVisible();
    await expect(page.getByRole('main').getByText(/Placed in .+, Mukono/).first()).toBeVisible();
    await settle(page, 1200);
    await page.screenshot({ path: `${DIR}/nursery-form-desktop.png`, fullPage: true });

    await page.goto('/nurseries/new');
    await page.getByLabel('Nursery name').fill(`E2E Test Nursery ${String(Date.now()).slice(-5)}`);
    await page.getByLabel('Operator name').fill('Ssekandi Peter');
    await page.getByLabel(/Contact phone/).fill('0772 456 789');
    await page.getByLabel(/Payout phone/).fill('0772 456 789');
    await page.getByLabel('Annual capacity (seedlings)').fill('12000');
    await page.getByLabel('Listed on the site').uncheck();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Place the nursery on the map.')).toBeVisible();
    await page.getByLabel(/Coordinates/).fill('0.3533, 32.7553');
    await page.getByLabel(/Coordinates/).blur();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('main').getByText(/Placed in .+, Mukono/).first()).toBeVisible();
    await settle(page, 1200);
    await page.screenshot({ path: `${DIR}/nursery-created-desktop.png`, fullPage: true });

    // Inventory grid
    await page.goto('/nurseries?q=Mukono%20Town');
    await page.getByRole('link', { name: 'Edit stock' }).click();
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    const qty = page.getByLabel(/^Quantity: /).first();
    await expect(qty).toBeVisible();
    const before = await qty.inputValue();
    await qty.fill(String(Number(before) + 5));
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText(/ saved$/).first()).toBeVisible();
    await qty.fill(before);
    await qty.press('Enter');
    await settle(page, 600);
    await page.screenshot({ path: `${DIR}/inventory-desktop.png`, fullPage: true });

    // CSV import: a file with a bad row is refused with row errors; the fixed file previews, then commits
    const file = (rows: string) => ({ name: 'stock.csv', mimeType: 'text/csv', buffer: Buffer.from(`nursery_name,species_slug,quantity,unit_price\n${rows}`) });
    const input = page.locator('input[type=file][accept*=csv]');
    await input.setInputFiles(file('Mukono Town Nursery,mvule,1300,1800\nMukono Town Nursery,not-a-tree,10,100\n'));
    await expect(page.getByRole('alert').filter({ hasText: /1 row has a problem/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Apply / })).toHaveCount(0);
    await settle(page, 300);
    await page.screenshot({ path: `${DIR}/csv-errors-desktop.png`, fullPage: true });
    await input.setInputFiles(file(`Mukono Town Nursery,mvule,${String(1300 + Math.floor(Math.random() * 500))},1800\n`));
    await expect(page.getByText(/1 changed|1 new/)).toBeVisible();
    await settle(page, 300);
    await page.screenshot({ path: `${DIR}/csv-preview-desktop.png`, fullPage: true });
    await page.getByRole('button', { name: /^Apply 1 change/ }).click();
    await expect(page.getByRole('region', { name: 'Import from CSV' }).getByRole('status')).toHaveText('1 stock line updated');

    await shot('species', async p => { await p.goto('/species'); await expect(p.getByRole('link', { name: 'Mvule' })).toBeVisible(); });
    await shot('species-form', async p => {
      await p.goto('/species');
      await p.getByRole('link', { name: 'Mvule' }).click();
      await expect(p.getByLabel('Common name')).toHaveValue('Mvule');
    });

    // News: write Markdown, preview it
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/news/new');
    await page.getByLabel('Title').fill('Short rains: plant from mid-October');
    await page.getByLabel('Article (Markdown)').fill('## Get ready\n\nThe **short rains** start mid-October.\n\n- Dig holes now\n- Water seedlings for two weeks');
    await page.getByRole('tab', { name: 'Preview' }).click();
    await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible();
    await settle(page, 300);
    await page.screenshot({ path: `${DIR}/news-preview-desktop.png`, fullPage: true });

    await shot('delivery-rates', async p => { await p.goto('/delivery-rates'); await expect(p.getByText(/e\.g\. 10 km costs/).first()).toBeVisible(); });

    // Campaign form: the rule builder drives the live preview of the buyer's form
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/campaigns');
    await page.getByRole('link', { name: /Coffee shade trees/ }).click();
    await expect(page.getByRole('heading', { name: 'What applicants will see' })).toBeVisible();
    await page.getByRole('button', { name: 'Add a rule' }).click();
    await page.getByLabel(/^Question shown to applicants \d+$/).last().fill('Do you have a water source nearby?');
    await expect(page.getByRole('complementary').getByText('Do you have a water source nearby?')).toBeVisible();
    await settle(page, 300);
    await page.screenshot({ path: `${DIR}/campaign-form-desktop.png`, fullPage: true });

    await shot('orders', async p => { await p.goto('/orders'); await expect(p.getByRole('heading', { name: 'Orders' })).toBeVisible(); await settle(p, 300); });
    await shot('payouts', async p => { await p.goto('/payouts?status=all'); await expect(p.getByRole('heading', { name: 'Payouts' })).toBeVisible(); await settle(p, 300); });

    // Audit log: the CSV import above is there, with its before/after
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/audit-log?action=inventory.update');
    await page.getByRole('button', { name: /^Show changes: inventory.update/ }).first().click();
    await expect(page.getByRole('columnheader', { name: 'Before' })).toBeVisible();
    await settle(page, 300);
    await page.screenshot({ path: `${DIR}/audit-log-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await settle(page, 300);
    await page.screenshot({ path: `${DIR}/audit-log-mobile.png`, fullPage: true });
  });

  test('no screen scrolls sideways on a phone', async ({ browser }) => {
    const page = await adminPage(browser);
    await page.setViewportSize({ width: 375, height: 812 });
    const nursery = (await (await page.request.get('/api/v1/nurseries?q=Mukono%20Town')).json()) as { data: { id: string }[] };
    const paths = ['/', '/insights', '/nurseries', `/nurseries/${nursery.data[0]?.id ?? ''}`, '/nurseries/new', `/inventory?nursery=${nursery.data[0]?.id ?? ''}`, '/species', '/news', '/news/new',
      '/delivery-rates', '/campaigns', '/campaigns/new', '/orders', '/payouts', '/audit-log'];
    const species = (await (await page.request.get('/api/v1/species?q=Mvule')).json()) as { data: { id: string }[] };
    const campaigns = (await (await page.request.get('/api/v1/campaigns?limit=1')).json()) as { data: { id: string }[] };
    paths.push(`/species/${species.data[0]?.id ?? ''}`, '/species/new', `/campaigns/${campaigns.data[0]?.id ?? ''}`, `/campaigns/${campaigns.data[0]?.id ?? ''}/applications`);
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await settle(page, 400);
      // Wide tables scroll inside their own box; the page itself must not
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} scrolls sideways by ${String(overflow)} px`).toBeLessThanOrEqual(0);
    }
    await page.goto('/species');
    await page.getByRole('link', { name: 'Mvule' }).click();
    await expect(page.getByLabel('Common name')).toHaveValue('Mvule');
    // The seeded photo comes from the public site and must load
    await expect.poll(() => page.locator('img').first().evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.context().close();
  });

  test('admin dispatches, buyer confirms, order completes', async ({ browser, page, request }) => {
    const buyer = await apiBuyer(request, 'Kato Joseph');
    const nursery = (await (await request.get('/api/v1/nurseries?q=Mukono%20Town')).json()) as { data: { id: string }[] };
    const nurseryId = nursery.data[0]?.id ?? '';
    const profile = (await (await request.get(`/api/v1/nurseries/${nurseryId}`)).json()) as { data: { inventory: { inventory_id: string }[] } };
    const quote = await request.post('/api/v1/orders/quote', { headers: buyer.auth, data: { nursery_id: nurseryId, items: [{ inventory_id: profile.data.inventory[0]?.inventory_id, quantity: 3 }], delivery_type: 'self_pickup' } });
    expect(quote.ok()).toBe(true);
    const token = ((await quote.json()) as { data: { quote_token: string } }).data.quote_token;
    const placed = await request.post('/api/v1/orders', { headers: buyer.auth, data: { quote_token: token, payment_method: 'mtn_momo', payer_phone: buyer.local } });
    expect(placed.status()).toBe(201);
    const order = ((await placed.json()) as { data: { id: string; short_code: string } }).data;
    await settlePayment(page, order.id, 'successful');

    // Admin: only the allowed actions are offered, and each needs a reason
    const admin = await adminPage(browser);
    await admin.goto(`/orders/${order.id}`);
    await expect(admin.getByRole('heading', { name: `Order ${order.short_code}` })).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Mark dispatched' })).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Refund the buyer' })).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Release payment to the nursery' })).toHaveCount(0);
    await admin.getByRole('button', { name: 'Mark dispatched' }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Mark dispatched' }).click();
    await expect(dialog.getByText('Write a reason of at least 5 characters.')).toBeVisible();
    await dialog.getByLabel(/Reason/).fill('Nursery confirmed by phone that the boda left');
    await settle(admin, 300);
    await admin.screenshot({ path: `${DIR}/order-reason-desktop.png` });
    await dialog.getByRole('button', { name: 'Mark dispatched' }).click();
    await expect(admin.getByText('Nursery confirmed by phone that the boda left')).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Mark dispatched' })).toHaveCount(0);
    await settle(admin, 300);
    await admin.screenshot({ path: `${DIR}/order-detail-desktop.png`, fullPage: true });

    // Buyer confirms on the public site
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.getByLabel('Phone number or email').fill(buyer.local);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'));
    await page.goto(`/orders/${order.id}`);
    await page.getByRole('button', { name: 'Confirm delivery' }).click();
    await page.getByRole('button', { name: 'Yes, confirm delivery' }).click();
    await expect.poll(async () => {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
      return page.getByText('Completed', { exact: true }).first().isVisible();
    }, { timeout: 30_000, intervals: [1000] }).toBe(true);

    await admin.reload();
    await expect(admin.getByText('Completed').first()).toBeVisible();
    await expect(admin.getByText('No actions: this order is finished or waiting for payment.')).toBeVisible();
    await admin.context().close();
  });

  test('buyer applies, admin approves in the queue', async ({ browser, request }) => {
    const buyer = await apiBuyer(request, 'Nabirye Ruth');
    const campaigns = (await (await request.get('/api/v1/campaigns?limit=50')).json()) as { data: { id: string; title: string }[] };
    const coffee = campaigns.data.find(c => c.title.startsWith('Coffee shade'));
    const applied = await request.post(`/api/v1/campaigns/${coffee?.id ?? ''}/apply`, {
      headers: buyer.auth,
      data: { answers: { coffee_farmer: true, coffee_trees: 300, farmer_group: 'Ntenjeru growers' }, quantity_requested: 25 },
    });
    expect(applied.status(), await applied.text()).toBe(201);

    const admin = await adminPage(browser);
    await expect(admin.getByText(/Nabirye Ruth/).first()).toBeVisible();
    await settle(admin, 300);
    await admin.screenshot({ path: `${DIR}/dashboard-items-desktop.png`, fullPage: true });
    await admin.goto(`/campaigns/${coffee?.id ?? ''}/applications`);
    const row = admin.getByRole('row').filter({ hasText: 'Nabirye Ruth' });
    await expect(row).toBeVisible();
    await settle(admin, 300);
    await admin.screenshot({ path: `${DIR}/applications-desktop.png`, fullPage: true });
    await row.getByRole('button', { name: 'Approve' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(admin.getByText('Approved. The applicant gets an SMS.').first()).toBeVisible();
    await expect.poll(async () => lastSms(admin, buyer.phone), { timeout: 20_000 }).toMatch(/approved/i);
    await admin.context().close();
  });
});
