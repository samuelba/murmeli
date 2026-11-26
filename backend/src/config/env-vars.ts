import type { EnvName } from './env.schema';

export type Requirement = 'yes' | 'no' | 'production';

export interface EnvVarDoc {
  readonly name: EnvName;
  readonly required: Requirement;
  readonly default?: string;
  readonly description: string;
}

const doc = (
  name: EnvName,
  required: Requirement,
  defaultValue: string | undefined,
  description: string,
): EnvVarDoc =>
  defaultValue === undefined
    ? { name, required, description }
    : { name, required, default: defaultValue, description };

export const ENV_VARS: readonly EnvVarDoc[] = [
  doc(
    'NODE_ENV',
    'no',
    'development',
    '`development`, `production` or `test`. Production enforces the production rules below, hides Swagger and hides 5xx details. A loud warning is logged when it is unset.',
  ),
  doc('PORT', 'no', '3000', 'HTTP port the API listens on.'),
  doc(
    'LOG_LEVEL',
    'no',
    'info',
    'pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.',
  ),
  doc(
    'TRUST_PROXY',
    'no',
    '1',
    'Number of reverse proxies in front of the API, `false`, or an address/subnet list. `true` is rejected.',
  ),
  doc(
    'APP_URL',
    'yes',
    undefined,
    'Public base URL of the app, used in email links and always allowed as an origin. Must be https in production; outside production only `http://localhost` may use http.',
  ),
  doc(
    'CORS_ORIGINS',
    'no',
    '',
    'Comma-separated extra browser origins allowed to call the API with credentials. No wildcards; same https rule as `APP_URL`.',
  ),
  doc('DATABASE_HOST', 'yes', undefined, 'Postgres host.'),
  doc('DATABASE_PORT', 'no', '5432', 'Postgres port.'),
  doc(
    'DATABASE_USERNAME',
    'yes',
    undefined,
    'Postgres role the app runs as. Use a least-privileged role (no DDL) in production.',
  ),
  doc(
    'DATABASE_PASSWORD',
    'yes',
    undefined,
    'Password of `DATABASE_USERNAME`.',
  ),
  doc('DATABASE_NAME', 'no', 'murmeli', 'Postgres database name.'),
  doc(
    'DATABASE_SSL',
    'no',
    'false',
    'TLS to Postgres: `false`, `true` (encrypted, certificate not verified) or `require-verify` (verified against the system CAs). Also applied to `pg_dump`.',
  ),
  doc(
    'DB_MIGRATIONS_RUN',
    'no',
    'true',
    'Back up and migrate in the Docker entrypoint before the app starts. Outside production the app also runs migrations at startup.',
  ),
  doc(
    'DB_MIGRATION_USERNAME',
    'no',
    undefined,
    'Schema owner used for migrations and backups. Falls back to `DATABASE_USERNAME`. Set together with `DB_MIGRATION_PASSWORD`.',
  ),
  doc(
    'DB_MIGRATION_PASSWORD',
    'no',
    undefined,
    'Password of `DB_MIGRATION_USERNAME`.',
  ),
  doc(
    'REDIS_HOST',
    'yes',
    undefined,
    'Redis (or Valkey) host for rate limiting and queues.',
  ),
  doc('REDIS_PORT', 'no', '6379', 'Redis port.'),
  doc('REDIS_PASSWORD', 'production', undefined, 'Redis password.'),
  doc(
    'JWT_SECRET',
    'yes',
    undefined,
    'Secret from which a separate signing key per token type (access, parent gate, kid, TOTP step) is derived. In production at least 32 random characters, no placeholder text, and different from the other secrets.',
  ),
  doc(
    'JWT_ACCESS_EXPIRATION',
    'no',
    '15m',
    'Access token lifetime (`ms`, `s`, `m`, `h` or `d` suffix).',
  ),
  doc('JWT_REFRESH_EXPIRATION', 'no', '30d', 'Refresh token lifetime.'),
  doc(
    'ENCRYPTION_KEY',
    'yes',
    undefined,
    'Key for secrets stored at rest (TOTP secrets, AES-256-GCM). Same rules as `JWT_SECRET`. Changing it makes enabled TOTP unusable.',
  ),
  doc(
    'COOKIE_SECURE',
    'no',
    'true',
    'Set the Secure flag on cookies. Must be `true` in production.',
  ),
  doc(
    'COOKIE_DOMAIN',
    'no',
    undefined,
    'Cookie Domain attribute. Leave empty for host-only cookies.',
  ),
  doc(
    'SMTP_HOST',
    'no',
    undefined,
    'SMTP server. Email is disabled when empty.',
  ),
  doc('SMTP_PORT', 'no', '587', 'SMTP port.'),
  doc(
    'SMTP_SECURE',
    'no',
    'false',
    'Use implicit TLS (port 465). STARTTLS is used otherwise when offered.',
  ),
  doc('SMTP_USER', 'no', undefined, 'SMTP user name.'),
  doc('SMTP_PASSWORD', 'no', undefined, 'SMTP password.'),
  doc(
    'SMTP_FROM',
    'no',
    undefined,
    'Sender address, required when `SMTP_HOST` is set.',
  ),
  doc(
    'REGISTRATION_ENABLED',
    'no',
    'false',
    'Open registration. Applied at every start until an admin changes the setting; from then on the admin setting wins.',
  ),
  doc(
    'ALTCHA_HMAC_KEY',
    'yes',
    undefined,
    'HMAC key for ALTCHA proof-of-work challenges. Same rules as `JWT_SECRET`.',
  ),
  doc(
    'RATE_LIMIT_TTL_SECONDS',
    'no',
    '60',
    'Window of the default per-IP rate limit (IPv6 clients are grouped by /64).',
  ),
  doc(
    'RATE_LIMIT_LIMIT',
    'no',
    '120',
    'Requests per IP and route allowed in the default window. If Redis is down this limit is skipped (fail open).',
  ),
  doc(
    'RATE_LIMIT_AUTH_TTL_SECONDS',
    'no',
    '300',
    'Window of the stricter `auth` rate limit on sign-in and account routes.',
  ),
  doc(
    'RATE_LIMIT_AUTH_LIMIT',
    'no',
    '10',
    'Requests per IP and route allowed in the `auth` window. If Redis is down auth routes answer 503 (fail closed).',
  ),
  doc(
    'RATE_LIMIT_EMAIL_TTL_SECONDS',
    'no',
    '3600',
    'Window of the per-IP `email` rate limit on register, forgot-password and resend-verification.',
  ),
  doc(
    'RATE_LIMIT_EMAIL_LIMIT',
    'no',
    '5',
    'Requests per IP and route allowed in the `email` window. Fails closed like the `auth` limit.',
  ),
  doc(
    'RATE_LIMIT_LOGIN_ACCOUNT_LIMIT',
    'no',
    '5',
    'Failed sign-ins per email address (existing or not) and client IP (IPv6 by /64) before that pair is locked.',
  ),
  doc(
    'RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_SECONDS',
    'no',
    '300',
    'Window in which failed sign-ins per email address and IP are counted.',
  ),
  doc(
    'RATE_LIMIT_LOGIN_ACCOUNT_LOCK_SECONDS',
    'no',
    '900',
    'How long an email address and IP pair stays locked after too many failed sign-ins.',
  ),
  doc(
    'RATE_LIMIT_LOGIN_EMAIL_LIMIT',
    'no',
    '50',
    'Failed sign-ins per email address from all IPs together before the address is locked for one window. Stops distributed guessing without letting one IP lock someone out.',
  ),
  doc(
    'RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS',
    'no',
    '3600',
    'Window (and lock time) of the per-address sign-in ceiling.',
  ),
  doc(
    'RATE_LIMIT_PARENT_GATE_LIMIT',
    'no',
    '5',
    'Wrong parent-gate passwords per user before the gate is locked for one window.',
  ),
  doc(
    'RATE_LIMIT_PARENT_GATE_WINDOW_SECONDS',
    'no',
    '300',
    'Window (and lock time) of the parent-gate limit.',
  ),
  doc(
    'RATE_LIMIT_TOTP_ATTEMPTS',
    'no',
    '5',
    'Wrong TOTP or recovery codes allowed per sign-in attempt before it must restart.',
  ),
  doc(
    'RATE_LIMIT_TOTP_USER_LIMIT',
    'no',
    '10',
    'Wrong TOTP or recovery codes per user across sign-ins and TOTP settings before TOTP checks are locked. Only a correct code resets it.',
  ),
  doc(
    'RATE_LIMIT_TOTP_USER_WINDOW_SECONDS',
    'no',
    '900',
    'Window and first lock time of the per-user TOTP limit; the lock doubles with every further lock within a day.',
  ),
  doc(
    'RATE_LIMIT_KID_PIN_LIMIT',
    'no',
    '5',
    'Wrong picture PINs per kid before the profile is locked.',
  ),
  doc(
    'RATE_LIMIT_KID_PIN_WINDOW_SECONDS',
    'no',
    '900',
    'Window of the picture PIN limit and the first lock time, which doubles with every further lock within a day.',
  ),
  doc(
    'RATE_LIMIT_EMAIL_RECIPIENT_LIMIT',
    'no',
    '3',
    'Account emails per address and kind (verification, reset, email change) per hour. Further requests still answer 202 but send nothing.',
  ),
  doc(
    'SETUP_TOKEN',
    'no',
    undefined,
    'When set, the first-admin setup also needs this token, so nobody else can claim a fresh instance. Generate one with `openssl rand -base64 24`. Production logs a warning while no user exists and it is unset.',
  ),
  doc(
    'PASSWORD_HIBP_CHECK',
    'no',
    'false',
    'Reject passwords found in the Have I Been Pwned breach list (k-anonymity range query, 2 s timeout, allowed through when the service is unreachable).',
  ),
  doc(
    'RATE_LIMIT_LEARN_WINDOW_SECONDS',
    'no',
    '60',
    'Window of the per-kid learning limits below.',
  ),
  doc(
    'RATE_LIMIT_LEARN_ANSWER_LIMIT',
    'no',
    '60',
    'Answers per kid allowed in the learning window. Further answers get 429 until the window ends.',
  ),
  doc(
    'RATE_LIMIT_LEARN_RUN_LIMIT',
    'no',
    '20',
    'Level and practice runs a kid may start in the learning window.',
  ),
  doc(
    'CONTENT_DIR',
    'no',
    undefined,
    'Curriculum directory (`tracks/`, `lexicon/`, `pictures.yaml`, `pictures/`). Defaults to the bundled `@murmeli/content` package. The backend refuses to start when the content does not validate.',
  ),
  doc(
    'APP_TIMEZONE',
    'no',
    'Europe/Zurich',
    'IANA time zone that defines the day boundary of the daily time limit and the activity statistics.',
  ),
  doc(
    'BACKUP_DIR',
    'no',
    '/app/backups',
    'Directory for the pre-migration `pg_dump` backups (created with mode 0700).',
  ),
  doc(
    'BACKUP_MANDATORY',
    'no',
    'true',
    'Refuse to migrate and start when the pre-migration backup fails.',
  ),
  doc('BACKUP_KEEP_COUNT', 'no', '10', 'Maximum number of backups to keep.'),
  doc(
    'BACKUP_MAX_AGE_DAYS',
    'no',
    '30',
    'Delete backups older than this many days. The newest backup is always kept.',
  ),
];

export const ENV_VAR_NAMES: readonly EnvName[] = ENV_VARS.map(
  (envVar) => envVar.name,
);
