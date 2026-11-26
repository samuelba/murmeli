#!/bin/sh
set -eu

if [ "${DB_MIGRATIONS_RUN:-true}" != "false" ]; then
  echo "Running the pre-migration backup..."
  node dist/scripts/pre-migration-backup.js
  echo "Running migrations..."
  node dist/scripts/migrate.js
else
  echo "DB_MIGRATIONS_RUN=false: skipping backup and migrations."
fi

exec node dist/main.js "$@"
