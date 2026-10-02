import { existsSync } from 'node:fs';

/**
 * The E2E suite runs on its own ports and its own database (reset and seeded when its API starts),
 * so it never touches the dev database or dev servers, and runs the same locally and in CI.
 */
if (existsSync('.env')) process.loadEnvFile('.env');

/** Running in CI (GitHub Actions sets CI=true): no server reuse, one retry, an HTML report. */
export const CI = Boolean(process.env.CI);

/**
 * E2E_TRIAL=1 runs the suite's API with the trial switches off (no SMS code, no payment step), for the
 * trial journey: E2E_TRIAL=1 npx playwright test e2e/trial.journey.spec.ts. Otherwise the full flows run.
 */
export const TRIAL = process.env.E2E_TRIAL === '1';

export const PORTS = { api: 4100, web: 4183, admin: 4184 } as const;
export const API_URL = `http://localhost:${String(PORTS.api)}`;
export const WEB_URL = `http://localhost:${String(PORTS.web)}`;
export const ADMIN_URL = `http://localhost:${String(PORTS.admin)}`;

/** E2E_DATABASE_URL, or the dev DATABASE_URL pointed at a database named nurserylink_e2e. */
export const E2E_DATABASE_URL: string = (() => {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error('Set E2E_DATABASE_URL (or DATABASE_URL) for the E2E suite');
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/nurserylink_e2e';
  return url.toString();
})();
