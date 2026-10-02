import { defineConfig } from 'drizzle-kit';

// drizzle-kit only needs the schema to generate migrations; it never connects here.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  // PostGIS owns spatial_ref_sys and its views; keep them out of generated migrations
  extensionsFilters: ['postgis'],
  strict: true,
  verbose: true,
});
