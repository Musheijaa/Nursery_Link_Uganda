import { parseConfig } from '../config.js';
import { createPool } from './client.js';
import { runMigrations } from './migrate.js';
import { seed, seedOptionsFromConfig } from './seed/index.js';

// Development helper: wipe the database, re-run every migration, then seed. Creates the database
// first if it does not exist (the E2E suite uses its own, e.g. nurserylink_e2e).
const config = parseConfig(process.env);
if (config.NODE_ENV === 'production') {
  console.error('Refusing to reset a production database');
  process.exit(1);
}

const ensureDatabase = async (url: string) => {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  const server = new URL(url);
  server.pathname = '/postgres';
  const admin = createPool(server.toString());
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) {
      // Identifiers can't be parameters; quote it as one
      await admin.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
      console.log(`Created database ${name}`);
    }
  } finally {
    await admin.end();
  }
};

await ensureDatabase(config.DATABASE_URL);
const pool = createPool(config.DATABASE_URL);
try {
  // Drizzle keeps its migration journal in the "drizzle" schema; queued jobs live in "pgboss"
  // (dropping it means no job from before the reset runs against the fresh data)
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE; CREATE SCHEMA public;');
  await runMigrations(pool);
  const summary = await seed(pool, seedOptionsFromConfig(config));
  console.log('Database reset and seeded:', summary);
} finally {
  await pool.end();
}
