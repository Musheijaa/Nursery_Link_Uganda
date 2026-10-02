import { expect, test, type APIRequestContext } from '@playwright/test';
import { registerBuyer, settle, toE164 } from './helpers';
import { shoot } from './screens';

const DIR = 'docs/screenshots/phase-6';

/** Admin approval through the admin API (the admin console arrives in phase 7). */
const approveAsAdmin = async (request: APIRequestContext, buyerPhone: string) => {
  const login = await request.post('/api/v1/auth/login', { data: { identifier: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD } });
  const token = ((await login.json()) as { data: { access_token: string } }).data.access_token;
  const auth = { Authorization: `Bearer ${token}` };
  const campaigns = (await (await request.get('/api/v1/admin/campaigns?limit=50', { headers: auth })).json()) as { data: { id: string; title: string }[] };
  const coffee = campaigns.data.find(c => c.title.startsWith('Coffee shade'));
  const apps = (await (await request.get(`/api/v1/admin/campaigns/${coffee?.id ?? ''}/applications?status=pending&limit=100`, { headers: auth })).json()) as {
    data: { id: string; applicant: { phone: string } }[];
  };
  const mine = apps.data.find(a => a.applicant.phone === buyerPhone);
  const res = await request.put(`/api/v1/admin/applications/${mine?.id ?? ''}`, { headers: auth, data: { status: 'approved', note: 'Checked with the LC1 chair' } });
  expect(res.ok()).toBe(true);
};

test.describe('phase 6: free seedlings', () => {
  test('directory and campaign page', async ({ page }) => {
    await shoot(page, 'phase-6', 'directory', async p => {
      await p.goto('/free-seedlings');
      await expect(p.getByText(/campaigns? running/)).toBeVisible();
    });
    await shoot(page, 'phase-6', 'campaign-signed-out', async p => {
      await p.goto('/free-seedlings');
      await p.getByRole('link', { name: /Coffee shade trees/ }).click();
      await expect(p.getByRole('link', { name: 'Sign in to apply' })).toBeVisible();
      await settle(p, 1000);
    });
  });

  test('buyer applies, admin approves, buyer sees it', async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const phone = await registerBuyer(page, 'Namutebi Grace');
    await page.goto('/free-seedlings?purpose=coffee');
    await page.getByRole('link', { name: /Coffee shade trees/ }).click();
    await expect(page.getByRole('heading', { name: 'Who can apply' })).toBeVisible();

    // The form comes from the campaign's eligibility rules and checks them before sending
    await page.getByRole('button', { name: 'Apply for free seedlings' }).click();
    await expect(page.getByText(/^Not eligible: "I grow coffee" is required/)).toBeVisible();
    await settle(page, 300);
    await page.screenshot({ path: `${DIR}/apply-errors-mobile.png`, fullPage: true });

    await page.getByRole('checkbox', { name: 'Yes, this is true for me' }).check();
    await page.getByLabel(/Number of coffee trees/).fill('450');
    await page.getByLabel('Farmer group (if any) (optional)').or(page.getByLabel(/Farmer group/)).first().fill('Nakisunga Coffee Growers');
    await page.getByLabel(/How many seedlings/).fill('60');
    await page.getByRole('button', { name: 'Apply for free seedlings' }).click();
    await expect(page.getByText('Application received — waiting for review')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/applied-mobile.png`, fullPage: true });

    await approveAsAdmin(request, toE164(phone));
    await page.reload();
    await expect(page.getByText('Approved — collect your seedlings')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${DIR}/approved-mobile.png`, fullPage: true });
  });
});
