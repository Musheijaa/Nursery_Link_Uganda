import { config } from '../config.js';
import { pool } from './pool.js';
import { runMigrations } from './migrate.js';
import { seed } from './seed.js';

// Development helper: wipes the database and rebuilds it from migrations and seed data.
if (config.NODE_ENV === 'production') {
  console.error('Refusing to reset a production database');
  process.exit(1);
}

try {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS postgis;');
  await runMigrations();
  await seed();
  console.log('Database reset and seeded');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
