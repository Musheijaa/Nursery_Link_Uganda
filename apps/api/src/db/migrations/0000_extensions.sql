-- Extensions the schema depends on. Must run before any table is created.
CREATE EXTENSION IF NOT EXISTS postgis;   -- geometry types and spatial functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy search on nursery and species names
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid() on PostgreSQL < 13 and digest helpers
