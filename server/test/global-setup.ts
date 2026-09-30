import './setup-env.js';

/** Rebuilds the test database from migrations and seed data before the suite runs. */
export default async function setup() {
  if (!process.env.DATABASE_URL?.includes('_test')) throw new Error('Refusing to run tests against a non-test database');
  const { pool } = await import('../src/db/pool.js');
  const { runMigrations } = await import('../src/db/migrate.js');
  const { seed } = await import('../src/db/seed.js');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS postgis;');
  await runMigrations(() => {});
  await seed();
  await pool.end();
}
