import type { Env } from '../../config/env.schema';

export const SMTP_ENV_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'APP_URL',
] as const;

export type SmtpEnv = Pick<Env, (typeof SMTP_ENV_KEYS)[number]>;

const TIMEOUT_MS = 10_000;

/**
 * Email is enabled when SMTP_HOST is set. Read from the raw environment
 * because the queue and its worker are only registered when it is.
 */
export function isEmailConfigured(
  raw: Record<string, string | undefined> = process.env,
): boolean {
  return (raw.SMTP_HOST ?? '').trim() !== '';
}

export interface SmtpTransportOptions {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly auth?: { readonly user: string; readonly pass: string };
  readonly connectionTimeout: number;
  readonly greetingTimeout: number;
  readonly socketTimeout: number;
}

export function buildTransportOptions(env: SmtpEnv): SmtpTransportOptions {
  const auth =
    env.SMTP_USER !== undefined && env.SMTP_PASSWORD !== undefined
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined;
  return {
    host: env.SMTP_HOST ?? '',
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(auth && { auth }),
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  };
}
