import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from './client.js';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('./migrations', import.meta.url));

/** Applies pending migrations. Each migration file runs in its own transaction. */
export const runMigrations = async (pool: pg.Pool): Promise<void> => {
  await migrate(createDb(pool), { migrationsFolder: MIGRATIONS_FOLDER });
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = createPool(url);
  try {
    await runMigrations(pool);
    console.log('Migrations applied');
  } finally {
    await pool.end();
  }
}
