import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pickEnv } from '../../../config/app-config';
import type { Env } from '../../../config/env.schema';
import { TOTP_STEP_TTL_SECONDS } from '../auth.constants';
import type { LimitPolicy } from './attempt-limiter.service';

const MAIL_WINDOW_SECONDS = 3600;

export const LIMIT_ENV_KEYS = [
  'RATE_LIMIT_LOGIN_ACCOUNT_LIMIT',
  'RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_SECONDS',
  'RATE_LIMIT_LOGIN_ACCOUNT_LOCK_SECONDS',
  'RATE_LIMIT_PARENT_GATE_LIMIT',
  'RATE_LIMIT_PARENT_GATE_WINDOW_SECONDS',
  'RATE_LIMIT_LOGIN_EMAIL_LIMIT',
  'RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS',
  'RATE_LIMIT_TOTP_ATTEMPTS',
  'RATE_LIMIT_TOTP_USER_LIMIT',
  'RATE_LIMIT_TOTP_USER_WINDOW_SECONDS',
  'RATE_LIMIT_EMAIL_RECIPIENT_LIMIT',
  'RATE_LIMIT_KID_PIN_LIMIT',
  'RATE_LIMIT_KID_PIN_WINDOW_SECONDS',
] as const;

/**
 * The identifier-based limits from the env, as policies for AttemptLimiter.
 */
@Injectable()
export class LimitPolicies {
  readonly login: LimitPolicy;
  readonly loginEmail: LimitPolicy;
  readonly parentGate: LimitPolicy;
  readonly totp: LimitPolicy;
  readonly totpUser: LimitPolicy;
  readonly kidPin: LimitPolicy;
  readonly mailRecipient: LimitPolicy;

  constructor(config: ConfigService<Env, true>) {
    const env = pickEnv(config, LIMIT_ENV_KEYS);
    this.login = {
      name: 'login',
      limit: env.RATE_LIMIT_LOGIN_ACCOUNT_LIMIT,
      windowSeconds: env.RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_SECONDS,
      lockSeconds: env.RATE_LIMIT_LOGIN_ACCOUNT_LOCK_SECONDS,
    };
    this.loginEmail = {
      name: 'login-email',
      limit: env.RATE_LIMIT_LOGIN_EMAIL_LIMIT,
      windowSeconds: env.RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS,
      lockSeconds: env.RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS,
    };
    this.parentGate = {
      name: 'parent-gate',
      limit: env.RATE_LIMIT_PARENT_GATE_LIMIT,
      windowSeconds: env.RATE_LIMIT_PARENT_GATE_WINDOW_SECONDS,
      lockSeconds: env.RATE_LIMIT_PARENT_GATE_WINDOW_SECONDS,
    };
    this.totp = {
      name: 'totp',
      limit: env.RATE_LIMIT_TOTP_ATTEMPTS,
      windowSeconds: TOTP_STEP_TTL_SECONDS,
      lockSeconds: TOTP_STEP_TTL_SECONDS,
    };
    this.totpUser = {
      name: 'totp-user',
      limit: env.RATE_LIMIT_TOTP_USER_LIMIT,
      windowSeconds: env.RATE_LIMIT_TOTP_USER_WINDOW_SECONDS,
      lockSeconds: env.RATE_LIMIT_TOTP_USER_WINDOW_SECONDS,
      exponential: true,
    };
    this.mailRecipient = {
      name: 'mail-recipient',
      limit: env.RATE_LIMIT_EMAIL_RECIPIENT_LIMIT,
      windowSeconds: MAIL_WINDOW_SECONDS,
      lockSeconds: MAIL_WINDOW_SECONDS,
    };
    this.kidPin = {
      name: 'kid-pin',
      limit: env.RATE_LIMIT_KID_PIN_LIMIT,
      windowSeconds: env.RATE_LIMIT_KID_PIN_WINDOW_SECONDS,
      lockSeconds: env.RATE_LIMIT_KID_PIN_WINDOW_SECONDS,
      exponential: true,
    };
  }
}
