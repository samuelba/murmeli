# Configuration

The backend reads its configuration from environment variables only. `validate-env.ts` checks all of them with zod at startup and exits with a list of every problem it finds. The source of truth is `env.schema.ts`; `env-vars.ts` exports the same list as `ENV_VARS` for documentation checks, and `env-vars.spec.ts` keeps the schema, `ENV_VARS` and this table in sync.

Empty values count as unset, so `FOO=` falls back to the default. `backend/.env.example` holds development values that are rejected in production.

## Production rules

With `NODE_ENV=production` the backend refuses to start unless:

- `JWT_SECRET`, `ENCRYPTION_KEY` and `ALTCHA_HMAC_KEY` are each at least 32 random characters, contain none of `change-me`, `changeme`, `dev-only`, `ci-only`, `example`, `sample` or `placeholder` (any case), and are all different. Generate them with `openssl rand -base64 48`.
- `REDIS_PASSWORD` is set.
- `COOKIE_SECURE` is `true`.
- `APP_URL` and every `CORS_ORIGINS` entry use https.

Outside production these problems are logged as warnings. When `NODE_ENV` is unset the backend runs in development mode and logs a warning.

## Migrations and database roles

In production, migrations only run in the Docker entrypoint: `pre-migration-backup.js`, then `migrate.js`, then the app. Both use `DB_MIGRATION_USERNAME` / `DB_MIGRATION_PASSWORD` (the schema owner) when set; the app uses `DATABASE_USERNAME`, which should be a role without DDL rights. `docker/postgres-init/10-app-role.sh` creates such a role for the official Postgres image.

## Variables

Required: `yes` always, `production` only with `NODE_ENV=production`.

| Variable                      | Required   | Default        | Description                                                                                                                                                            |
| ----------------------------- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                    | no         | `development`  | `development`, `production` or `test`. Production enforces the production rules below, hides Swagger and hides 5xx details. A loud warning is logged when it is unset. |
| `PORT`                        | no         | `3000`         | HTTP port the API listens on.                                                                                                                                          |
| `LOG_LEVEL`                   | no         | `info`         | pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.                                                                                        |
| `TRUST_PROXY`                 | no         | `1`            | Number of reverse proxies in front of the API, `false`, or an address/subnet list. `true` is rejected.                                                                 |
| `APP_URL`                     | yes        |                | Public base URL of the app, used in email links and always allowed as an origin. Must be https in production; outside production only `http://localhost` may use http. |
| `CORS_ORIGINS`                | no         | (empty)        | Comma-separated extra browser origins allowed to call the API with credentials. No wildcards; same https rule as `APP_URL`.                                            |
| `DATABASE_HOST`               | yes        |                | Postgres host.                                                                                                                                                         |
| `DATABASE_PORT`               | no         | `5432`         | Postgres port.                                                                                                                                                         |
| `DATABASE_USERNAME`           | yes        |                | Postgres role the app runs as. Use a least-privileged role (no DDL) in production.                                                                                     |
| `DATABASE_PASSWORD`           | yes        |                | Password of `DATABASE_USERNAME`.                                                                                                                                       |
| `DATABASE_NAME`               | no         | `murmeli`      | Postgres database name.                                                                                                                                                |
| `DATABASE_SSL`                | no         | `false`        | TLS to Postgres: `false`, `true` (encrypted, certificate not verified) or `require-verify` (verified against the system CAs). Also applied to `pg_dump`.               |
| `DB_MIGRATIONS_RUN`           | no         | `true`         | Back up and migrate in the Docker entrypoint before the app starts. Outside production the app also runs migrations at startup.                                        |
| `DB_MIGRATION_USERNAME`       | no         |                | Schema owner used for migrations and backups. Falls back to `DATABASE_USERNAME`. Set together with `DB_MIGRATION_PASSWORD`.                                            |
| `DB_MIGRATION_PASSWORD`       | no         |                | Password of `DB_MIGRATION_USERNAME`.                                                                                                                                   |
| `REDIS_HOST`                  | yes        |                | Redis (or Valkey) host for rate limiting and queues.                                                                                                                   |
| `REDIS_PORT`                  | no         | `6379`         | Redis port.                                                                                                                                                            |
| `REDIS_PASSWORD`              | production |                | Redis password.                                                                                                                                                        |
| `JWT_SECRET`                  | yes        |                | Secret for signing tokens. In production at least 32 random characters, no placeholder text, and different from the other secrets.                                     |
| `JWT_ACCESS_EXPIRATION`       | no         | `15m`          | Access token lifetime (`ms`, `s`, `m`, `h` or `d` suffix).                                                                                                             |
| `JWT_REFRESH_EXPIRATION`      | no         | `30d`          | Refresh token lifetime.                                                                                                                                                |
| `ENCRYPTION_KEY`              | yes        |                | Key for secrets stored at rest (TOTP). Same rules as `JWT_SECRET`.                                                                                                     |
| `COOKIE_SECURE`               | no         | `true`         | Set the Secure flag on cookies. Must be `true` in production.                                                                                                          |
| `COOKIE_DOMAIN`               | no         |                | Cookie Domain attribute. Leave empty for host-only cookies.                                                                                                            |
| `SMTP_HOST`                   | no         |                | SMTP server. Email is disabled when empty.                                                                                                                             |
| `SMTP_PORT`                   | no         | `587`          | SMTP port.                                                                                                                                                             |
| `SMTP_SECURE`                 | no         | `false`        | Use implicit TLS (port 465). STARTTLS is used otherwise when offered.                                                                                                  |
| `SMTP_USER`                   | no         |                | SMTP user name.                                                                                                                                                        |
| `SMTP_PASSWORD`               | no         |                | SMTP password.                                                                                                                                                         |
| `SMTP_FROM`                   | no         |                | Sender address, required when `SMTP_HOST` is set.                                                                                                                      |
| `REGISTRATION_ENABLED`        | no         | `false`        | Open registration. Applied at every start until an admin changes the setting; from then on the admin setting wins.                                                     |
| `ALTCHA_HMAC_KEY`             | yes        |                | HMAC key for ALTCHA proof-of-work challenges. Same rules as `JWT_SECRET`.                                                                                              |
| `RATE_LIMIT_TTL_SECONDS`      | no         | `60`           | Window of the default per-IP rate limit (IPv6 clients are grouped by /64).                                                                                             |
| `RATE_LIMIT_LIMIT`            | no         | `120`          | Requests per IP and route allowed in the default window. If Redis is down this limit is skipped (fail open).                                                           |
| `RATE_LIMIT_AUTH_TTL_SECONDS` | no         | `300`          | Window of the stricter `auth` rate limit on sign-in and account routes.                                                                                                |
| `RATE_LIMIT_AUTH_LIMIT`       | no         | `10`           | Requests per IP and route allowed in the `auth` window. If Redis is down auth routes answer 503 (fail closed).                                                         |
| `BACKUP_DIR`                  | no         | `/app/backups` | Directory for the pre-migration `pg_dump` backups (created with mode 0700).                                                                                            |
| `BACKUP_MANDATORY`            | no         | `true`         | Refuse to migrate and start when the pre-migration backup fails.                                                                                                       |
| `BACKUP_KEEP_COUNT`           | no         | `10`           | Maximum number of backups to keep.                                                                                                                                     |
| `BACKUP_MAX_AGE_DAYS`         | no         | `30`           | Delete backups older than this many days. The newest backup is always kept.                                                                                            |
