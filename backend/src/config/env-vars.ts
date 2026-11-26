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
    'Secret for signing tokens. In production at least 32 random characters, no placeholder text, and different from the other secrets.',
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
    'Key for secrets stored at rest (TOTP). Same rules as `JWT_SECRET`.',
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
