#!/bin/sh
# Creates the least-privileged runtime role for the backend. Runs once from
# /docker-entrypoint-initdb.d of the official postgres image, as POSTGRES_USER,
# which owns the schema and runs the migrations. The migrations (and every
# migrate.js run after them) narrow the default grants further: the role may
# only UPDATE the anonymisable columns of audit_log (actor_id, ip, target_id)
# and never UPDATE attempts (src/database/narrowed-grants.ts).
set -eu

: "${POSTGRES_APP_USER:?POSTGRES_APP_USER must be set}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set app_user="$POSTGRES_APP_USER" \
  --set app_password="$POSTGRES_APP_PASSWORD" \
  --set owner="$POSTGRES_USER" \
  --set db="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
  PASSWORD :'app_password';
ALTER ROLE :"app_user" SET statement_timeout = '15s';
ALTER ROLE :"app_user" SET idle_in_transaction_session_timeout = '30s';

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO :"app_user";
SQL
