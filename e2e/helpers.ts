import { expect, type Browser, type Page } from '@playwright/test';
import { ADMIN_URL } from './env';

/** A fresh MTN number per run, so registration never collides with an earlier test. */
export const randomMtnPhone = () => `0772${String(Math.floor(100000 + Math.random() * 899999))}`;
export const toE164 = (local: string) => `+256${local.slice(1)}`;

/** Latest text the mock SMS provider "sent" to a number (dev-only API helper). */
export const lastSms = async (page: Page, e164: string): Promise<string> => {
  const res = await page.request.get(`/api/v1/dev/sms-outbox?to=${encodeURIComponent(e164)}`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { data: { message: string }[] };
  return body.data[0]?.message ?? '';
};

/** Registers through the real screens, reading the code from the mock SMS outbox. Returns the phone. */
export const registerBuyer = async (page: Page, name = 'Nakato Sarah'): Promise<string> => {
  const phone = randomMtnPhone();
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel(/Phone number/).fill(phone);
  await page.getByLabel('Password', { exact: true }).fill('seedlings-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Enter the code we sent you' })).toBeVisible();
  const code = /(\d{6})/.exec(await lastSms(page, toE164(phone)))?.[1] ?? '';
  // Like SMS autofill: the whole code lands in the first box
  await page.getByLabel('Digit 1 of 6').fill(code);
  await expect(page.getByRole('button', { name: 'Sign out' }).or(page.getByRole('button', { name: 'Menu' })).first()).toBeVisible();
  return phone;
};

/** Stands in for the buyer approving (or declining) the prompt on their phone (dev-only API helper). */
export const settlePayment = async (page: Page, orderId: string, status: 'successful' | 'failed') => {
  const res = await page.request.post('/api/v1/dev/mock-payments/settle', { data: { order_id: orderId, status } });
  expect(res.ok()).toBe(true);
};

export const settle = async (page: Page, ms = 600) => {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
};

/** A new browser context signed in to the admin console (its own cookies, like a separate device). */
export const adminPage = async (browser: Browser): Promise<Page> => {
  const context = await browser.newContext({ baseURL: ADMIN_URL, viewport: { width: 1280, height: 800 }, locale: 'en-UG', timezoneId: 'Africa/Kampala', acceptDownloads: true });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Phone number or email').fill(process.env.ADMIN_PHONE ?? '');
  await page.getByLabel('Password').fill(process.env.ADMIN_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  return page;
};
