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
| `admin`    | User management (keeps at least one active admin), invites, password reset links and manual email verification, settings, stats and the audit log.                                                                                                                                                                     |
| `audit`    | Typed audit log with truncated IPs (/24, /48) and no PII, plus the daily retention job (audit 180 days, attempts `ATTEMPTS_RETENTION_DAYS`; expired tokens and invites).                                                                                                                                               |
| `email`    | Handlebars templates (`templates/<locale>/<name>.{html,txt}.hbs`), nodemailer, and the BullMQ `email` queue. Disabled when `SMTP_HOST` is empty.                                                                                                                                                                       |
| `settings` | `app_settings` (`registration_enabled`, `require_admin_totp`). Env values apply until an admin changes a setting.                                                                                                                                                                                                      |
| `learning` | The learning engine (contract: [docs/internal/learning-engine.md](../docs/internal/learning-engine.md)): trail map, level and practice runs, answers, scoring, unlocking, mastery, daily limit, badges and the parent progress view. See below.                                                                        |
| `altcha`   | Self-hosted ALTCHA v2 challenges (SHA-256, HMAC-signed, 10 minutes, single use via Redis).                                                                                                                                                                                                                             |

Global guards run in this order: `SameOriginGuard`, the Redis throttler (`default`, `auth` and `email` limits), then `AuthGuard`. Identifier-based limits (per account, user, sign-in step and kid) are in `auth/limits` and fail closed.

## Learning engine

The curriculum comes from `@murmeli/content` (`file:../content`), which is loaded and validated once at startup (`CONTENT_DIR`, default: the bundled package). Invalid content stops the backend and lists every issue. Build `content/` (`npm ci && npm run build` in `content/`) before installing or building the backend.

| Route (all under `/api`)           | Guard       | Response (types from `content/schema/api.ts`)                                                |
| ---------------------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `GET /learn/map`                   | kid         | `MapResponse`: only the tracks of the kid's language, localized                              |
| `POST /learn/levels/:levelId/runs` | kid         | `201 StartRunResponse`; `403 LEVEL_LOCKED`, `404 LEVEL_NOT_FOUND`, `403 DAILY_LIMIT_REACHED` |
| `POST /learn/practice/runs`        | kid         | `201 PracticeRunResponse`; `409 NOTHING_TO_PRACTICE`, `403 DAILY_LIMIT_REACHED`              |
| `POST /learn/runs/:runId/answers`  | kid         | `AnswerResponse`; `400 VALIDATION_FAILED`, `404 RUN_NOT_FOUND`, `409 ITEM_DONE`/`RUN_BUSY`   |
| `POST /learn/runs/:runId/finish`   | kid         | `FinishRunResponse`; `404 RUN_NOT_FOUND` (also when finished already)                        |
| `GET /parent/kids/:id/progress`    | parent gate | `ParentProgressResponse` (`learning/parent/parent-progress.types.ts`); `404 KID_NOT_FOUND`   |

- **Runs** live in Redis as `murmeli:run:<runId>` (2 h TTL) with the seed, the solutions and the attempts; `murmeli:run-active:<kidId>` points at the kid's only active run, and starting a run replaces it (the replaced run's answer time still counts for the day). Updates are compare-and-set Lua scripts, so two concurrent answers cannot use the same attempt and a run is finished exactly once; if saving the result fails, the run is put back so the finish can be retried. Another kid's run answers 404 like an unknown one.
- **Answers:** 2 attempts per item, a `hint` after a wrong first attempt, `solution` after the last one. Durations are measured on the server from when the item was served or last answered, capped at 5 minutes. Every attempt is written to `attempts` (append-only for the runtime role).
- **Demo:** every level run includes `demo`, so the kid can replay "show me"; `demoSeen` is true when `level_progress.demo_seen_at` was already set before this run. The first run start marks it as seen. Practice runs have no demo and report `demoSeen: true`.
- **Finishing:** `score` is the mean item score (unanswered items count 0), `stars`/`passed` follow `starsFor`; `level_progress` keeps the best result; skill mastery is an EWMA (0.7 / 0.3, the first run seeds it) with Leitner boxes of 1, 2, 4, 8 and 16 days, updated only for skills with at least one answer; `daily_activity` gets the run time and a run; newly opened levels and worlds are the difference of the map before and after. Practice runs update mastery and time but not stars (their `stars` are only feedback and `passed` is always false).
- **Unlocking:** worlds open once every `requires` world is completed; levels open in order; worlds below the kid's start class are `skipped` (open, and completed for `requires`); a passed level stays passed.
- **Practice:** up to 3 skills of open levels: due skills (earliest review first), then never-played skills, then the weakest; 8 to 10 interleaved items from those skills' open levels. Every level has at least one generator and every language has worlds without `requires`, so `409 NOTHING_TO_PRACTICE` only happens when no open level has a generator, which the content schema rules out.
- **Daily limit:** the run time of the current day in `APP_TIMEZONE` is checked when a run starts.
- **Badges** (`progress/badges.ts`): `first-level`, `first-world`, `star-collector` (5 levels with 3 stars), `first-practice`. They are never taken away and nothing depends on streaks.
- **Rate limits:** per kid, `RATE_LIMIT_LEARN_ANSWER_LIMIT` answers and `RATE_LIMIT_LEARN_RUN_LIMIT` run starts per `RATE_LIMIT_LEARN_WINDOW_SECONDS` (`429 LEARN_RATE_LIMITED` with `Retry-After`), on top of the per-IP limit.
- **Export:** `GET /account/export` includes per kid the level progress, mastery, daily activity, badges and the attempts summarized per skill and mode.
- **Attempts retention:** the daily cleanup (03:00) deletes attempts older than `ATTEMPTS_RETENTION_DAYS` (default 365, at least 30) in batches of 10,000, using `IDX_attempts_created_at`. The map, stars, mastery, badges, daily activity and the parent progress view do not read `attempts`, so they are unaffected; only the per-skill attempt summary in the export covers the retained period.

## Admin account recovery

For parents who cannot receive email (contract: [docs/internal/api-accounts.md](../docs/internal/api-accounts.md)):

| Route (all under `/api`, `AdminGuard`)      | Response                                                                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /admin/users/:id/password-reset-link` | `201 { resetUrl, expiresAt }`. A normal `password_reset` token (hashed, 1 h, single use) that replaces open reset tokens; no email is sent. `404 USER_NOT_FOUND`, `409 USER_DISABLED`; `auth` rate limit. |
| `POST /admin/users/:id/verify-email`        | `200 AdminUser`. Idempotent; also invalidates open verification links. `404 USER_NOT_FOUND`.                                                                                                              |

Both are audited (`admin.password_reset_link_created`, `admin.email_verified` only when the address changes); the token never appears in the audit log. `GET /auth/config` also returns `legal: { operatorName, contactEmail, address, privacyNote }` from the `OPERATOR_*` variables (null when unset, plain text).

## Docker image

The image is built from the repository root, because it includes the curriculum: `docker build -f backend/Dockerfile --target production .` (`backend/Dockerfile.dockerignore` limits the context to `backend/` and `content/`). The production stage holds the backend in `/app/backend` and the built content package (`dist`, `tracks`, `lexicon`, `pictures.yaml`, `pictures/`, which the validator checks) in `/app/content`.

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
