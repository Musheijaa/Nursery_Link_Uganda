import type pg from 'pg';
import { runMigrations } from '../src/db/migrate.js';
import { seed, type SeedOptions } from '../src/db/seed/index.js';

export const TEST_ADMIN: SeedOptions['admin'] = {
  fullName: 'Test Administrator',
  phone: '0700000001',
  email: 'Admin@Example.org',
  password: 'test-admin-password-123',
};

/** Migrates and seeds the test database. Both steps are idempotent, so every test file may call this. */
export const prepareTestDatabase = async (pool: pg.Pool) => {
  await runMigrations(pool);
  return seed(pool, { admin: TEST_ADMIN });
};

/** Runs fn in a transaction that is always rolled back, so tests can write without affecting each other. */
export const inRollback = async (pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<void>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
};

/** Asserts that a query fails with the given Postgres error code (e.g. 23514 check_violation). */
export const pgErrorCode = async (promise: Promise<unknown>): Promise<string | undefined> => {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
};
