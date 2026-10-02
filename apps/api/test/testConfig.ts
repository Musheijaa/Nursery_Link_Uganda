import { parseConfig, type Config } from '../src/config.js';

/** A complete, valid configuration for tests, using mock providers throughout. */
export const baseTestEnv = (databaseUrl: string): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: databaseUrl,
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174',
  PUBLIC_WEB_URL: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
  QUOTE_TOKEN_SECRET: 'test-quote-secret-that-is-at-least-32-chars',
  OTP_HMAC_SECRET: 'test-otp-hmac-secret-that-is-at-least-32-chars',
  // Functional tests are not throttled; security.test.ts checks the real limits with scale 1
  RATE_LIMIT_SCALE: '1000',
  // Every response in the suite is checked against its OpenAPI schema
  VALIDATE_RESPONSES: 'true',
});

export const testConfig = (databaseUrl: string, overrides: NodeJS.ProcessEnv = {}): Config =>
  parseConfig({ ...baseTestEnv(databaseUrl), ...overrides });
