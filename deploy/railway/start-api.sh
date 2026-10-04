#!/usr/bin/env sh
# Start command for the API container: bring the database up to date, then serve.
# Migrations and the seed are both idempotent (the seed never overwrites admin edits or the
# admin's password), so running them on every start keeps a fresh deploy and a restart identical.
set -eu
cd /app/apps/api
node dist/db/migrate.js
node dist/db/seed/index.js
exec node dist/server.js
