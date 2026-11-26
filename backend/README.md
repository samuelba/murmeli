# Murmeli backend

NestJS API under `/api`, with TypeORM (Postgres), Redis/Valkey (rate limits, BullMQ) and pino logging. Configuration is described in [src/config/README.md](src/config/README.md); the accounts API contract is [docs/internal/api-accounts.md](../docs/internal/api-accounts.md).

## Modules

All feature modules live in `src/modules/`.

| Module     | Responsibility                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`     | Setup, login with optional TOTP step, refresh rotation with reuse detection, logout, registration and email verification, password reset, invites, parent gate. Owns the global deny-by-default `AuthGuard` (`@Public()` opts out), `ParentGateGuard`, `AdminGuard`, the `mu_*` cookies and the HKDF-derived JWT keys. |
| `users`    | `users` table and the `User` view returned by the API.                                                                                                                                                                                                                                                                 |
| `kids`     | Kid profiles (max 8 per account), avatar validation against `avatar-catalog.ts`, picture PIN with exponential lockout, `mu_kid` sessions and `KidGuard`.                                                                                                                                                               |
| `account`  | `/auth/me` and the parent's own account: password and email change, preferences, JSON export, deletion.                                                                                                                                                                                                                |
| `admin`    | User management (keeps at least one active admin), invites, settings, stats and the audit log.                                                                                                                                                                                                                         |
| `audit`    | Typed audit log with truncated IPs (/24, /48) and no PII, plus the daily retention job (180 days; expired tokens and invites).                                                                                                                                                                                         |
| `email`    | Handlebars templates (`templates/<locale>/<name>.{html,txt}.hbs`), nodemailer, and the BullMQ `email` queue. Disabled when `SMTP_HOST` is empty.                                                                                                                                                                       |
| `settings` | `app_settings` (`registration_enabled`, `require_admin_totp`). Env values apply until an admin changes a setting.                                                                                                                                                                                                      |
| `altcha`   | Self-hosted ALTCHA v2 challenges (SHA-256, HMAC-signed, 10 minutes, single use via Redis).                                                                                                                                                                                                                             |

Global guards run in this order: `SameOriginGuard`, the Redis throttler (`default`, `auth` and `email` limits), then `AuthGuard`. Identifier-based limits (per account, user, sign-in step and kid) are in `auth/limits` and fail closed.

## Scripts

| Command                                             | What it does                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run start:dev`                                 | Dev server with watch mode.                                                          |
| `npm run test:cov`                                  | Unit tests with coverage (80% minimum on every metric).                              |
| `npm run test:e2e`                                  | e2e tests; without `E2E_DB=1` only the tests that need no services run.              |
| `npm run avatars:sync`                              | Regenerates `src/modules/kids/avatar-catalog.ts` from `brand/avatars/manifest.json`. |
| `npm run migration:generate -- src/migrations/Name` | Generates a migration from the entity changes (as the schema owner).                 |

## Real-database e2e tests

`E2E_DB=1 npm run test:e2e` runs against Postgres, Valkey and, when `MAILPIT_URL` is set, Mailpit. A global setup migrates as `DB_MIGRATION_USERNAME`, empties the user tables and Redis, and the app then runs as the least-privileged `DATABASE_USERNAME` (created by `docker/postgres-init/10-app-role.sh`). Point `SMTP_HOST`/`SMTP_PORT` at Mailpit's SMTP port and `MAILPIT_URL` at its HTTP API (e.g. `http://localhost:8025`) to include the email flows.
