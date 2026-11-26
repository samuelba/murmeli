import { z } from 'zod';
import { errorMessage } from '../common/errors/error-message';
import {
  envBoolean,
  envDuration,
  envInt,
  envPort,
  envRequired,
  isHttpOrigin,
  normalizeOrigin,
  parseOriginList,
} from './env-parsers';
import { parseTrustProxy } from './trust-proxy';

const trustProxy = z
  .string()
  .default('1')
  .transform((raw, ctx) => {
    try {
      return parseTrustProxy(raw);
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: errorMessage(error) });
      return z.NEVER;
    }
  });

const appUrl = envRequired()
  .pipe(z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' }))
  .transform(normalizeOrigin);

const corsOrigins = z
  .string()
  .default('')
  .transform(parseOriginList)
  .pipe(
    z.array(
      z.string().refine(isHttpOrigin, {
        error:
          'must be a comma-separated list of origins like https://murmeli.example.com (no wildcards, paths or trailing slashes)',
      }),
    ),
  );

const optionalText = z.string().trim().min(1).optional();

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timeZone = z.string().trim().default('Europe/Zurich').refine(isTimeZone, {
  error: 'must be an IANA time zone like Europe/Zurich',
});

export const DATABASE_SSL_MODES = ['false', 'true', 'require-verify'] as const;

export const databaseEnvShape = {
  DATABASE_HOST: envRequired(),
  DATABASE_PORT: envPort(5432),
  DATABASE_USERNAME: envRequired(),
  DATABASE_PASSWORD: envRequired(),
  DATABASE_NAME: z.string().trim().min(1).default('murmeli'),
  DATABASE_SSL: z.enum(DATABASE_SSL_MODES).default('false'),
  DB_MIGRATIONS_RUN: envBoolean(true),
  DB_MIGRATION_USERNAME: optionalText,
  DB_MIGRATION_PASSWORD: optionalText,
};

type MigrationCredentials = {
  DB_MIGRATION_USERNAME?: string;
  DB_MIGRATION_PASSWORD?: string;
};

export function checkMigrationCredentials(
  env: MigrationCredentials,
  ctx: z.RefinementCtx,
): void {
  const hasUser = env.DB_MIGRATION_USERNAME !== undefined;
  const hasPassword = env.DB_MIGRATION_PASSWORD !== undefined;
  if (hasUser !== hasPassword) {
    ctx.addIssue({
      code: 'custom',
      path: [hasUser ? 'DB_MIGRATION_PASSWORD' : 'DB_MIGRATION_USERNAME'],
      message:
        'DB_MIGRATION_USERNAME and DB_MIGRATION_PASSWORD must be set together',
    });
  }
}

export const identifierRateLimitShape = {
  RATE_LIMIT_EMAIL_TTL_SECONDS: envInt(3600, 1, 86_400),
  RATE_LIMIT_EMAIL_LIMIT: envInt(5, 1, 10_000),
  RATE_LIMIT_LOGIN_ACCOUNT_LIMIT: envInt(5, 1, 1000),
  RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_SECONDS: envInt(300, 1, 86_400),
  RATE_LIMIT_LOGIN_ACCOUNT_LOCK_SECONDS: envInt(900, 1, 86_400),
  RATE_LIMIT_PARENT_GATE_LIMIT: envInt(5, 1, 1000),
  RATE_LIMIT_PARENT_GATE_WINDOW_SECONDS: envInt(300, 1, 86_400),
  RATE_LIMIT_LOGIN_EMAIL_LIMIT: envInt(50, 1, 100_000),
  RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS: envInt(3600, 1, 86_400),
  RATE_LIMIT_TOTP_ATTEMPTS: envInt(5, 1, 100),
  RATE_LIMIT_TOTP_USER_LIMIT: envInt(10, 1, 1000),
  RATE_LIMIT_TOTP_USER_WINDOW_SECONDS: envInt(900, 1, 86_400),
  RATE_LIMIT_EMAIL_RECIPIENT_LIMIT: envInt(3, 1, 1000),
  RATE_LIMIT_KID_PIN_LIMIT: envInt(5, 1, 1000),
  RATE_LIMIT_KID_PIN_WINDOW_SECONDS: envInt(900, 1, 86_400),
  RATE_LIMIT_LEARN_WINDOW_SECONDS: envInt(60, 1, 3600),
  RATE_LIMIT_LEARN_ANSWER_LIMIT: envInt(60, 1, 10_000),
  RATE_LIMIT_LEARN_RUN_LIMIT: envInt(20, 1, 10_000),
};

export const backupEnvShape = {
  BACKUP_DIR: z.string().trim().min(1).default('/app/backups'),
  BACKUP_MANDATORY: envBoolean(true),
  BACKUP_KEEP_COUNT: envInt(10, 1, 1000),
  BACKUP_MAX_AGE_DAYS: envInt(30, 1, 3650),
};

export const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: envPort(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  TRUST_PROXY: trustProxy,
  APP_URL: appUrl,
  CORS_ORIGINS: corsOrigins,

  ...databaseEnvShape,

  REDIS_HOST: envRequired(),
  REDIS_PORT: envPort(6379),
  REDIS_PASSWORD: optionalText,

  JWT_SECRET: envRequired(),
  JWT_ACCESS_EXPIRATION: envDuration('15m'),
  JWT_REFRESH_EXPIRATION: envDuration('30d'),
  ENCRYPTION_KEY: envRequired(),

  COOKIE_SECURE: envBoolean(true),
  COOKIE_DOMAIN: optionalText,

  SMTP_HOST: optionalText,
  SMTP_PORT: envPort(587),
  SMTP_SECURE: envBoolean(false),
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  SMTP_FROM: optionalText,

  REGISTRATION_ENABLED: envBoolean(false),
  ALTCHA_HMAC_KEY: envRequired(),

  RATE_LIMIT_TTL_SECONDS: envInt(60, 1, 86_400),
  RATE_LIMIT_LIMIT: envInt(120, 1, 1_000_000),
  RATE_LIMIT_AUTH_TTL_SECONDS: envInt(300, 1, 86_400),
  RATE_LIMIT_AUTH_LIMIT: envInt(10, 1, 10_000),
  ...identifierRateLimitShape,

  PASSWORD_HIBP_CHECK: envBoolean(false),
  SETUP_TOKEN: optionalText,

  CONTENT_DIR: optionalText,
  APP_TIMEZONE: timeZone,

  ...backupEnvShape,
});

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  checkMigrationCredentials(env, ctx);
  if (env.SMTP_HOST !== undefined && env.SMTP_FROM === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['SMTP_FROM'],
      message: 'is required when SMTP_HOST is set',
    });
  }
});

export type Env = z.output<typeof envSchema>;
export type EnvName = keyof typeof baseEnvSchema.shape;
