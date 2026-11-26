import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema';
import { TOTP_STEP_TTL_SECONDS } from '../auth.constants';
import { LimitPolicies } from './limit-policies';

const ENV: Record<string, number> = {
  RATE_LIMIT_LOGIN_ACCOUNT_LIMIT: 5,
  RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_SECONDS: 300,
  RATE_LIMIT_LOGIN_ACCOUNT_LOCK_SECONDS: 900,
  RATE_LIMIT_PARENT_GATE_LIMIT: 4,
  RATE_LIMIT_PARENT_GATE_WINDOW_SECONDS: 120,
  RATE_LIMIT_LOGIN_EMAIL_LIMIT: 50,
  RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS: 3600,
  RATE_LIMIT_TOTP_ATTEMPTS: 3,
  RATE_LIMIT_TOTP_USER_LIMIT: 10,
  RATE_LIMIT_TOTP_USER_WINDOW_SECONDS: 900,
  RATE_LIMIT_EMAIL_RECIPIENT_LIMIT: 3,
  RATE_LIMIT_KID_PIN_LIMIT: 6,
  RATE_LIMIT_KID_PIN_WINDOW_SECONDS: 600,
};

describe('LimitPolicies', () => {
  const policies = new LimitPolicies({
    get: (key: string) => ENV[key],
  } as unknown as ConfigService<Env, true>);

  it('builds the policies from the env', () => {
    expect(policies.login).toEqual({
      name: 'login',
      limit: 5,
      windowSeconds: 300,
      lockSeconds: 900,
    });
    expect(policies.parentGate).toEqual({
      name: 'parent-gate',
      limit: 4,
      windowSeconds: 120,
      lockSeconds: 120,
    });
    expect(policies.totp).toEqual({
      name: 'totp',
      limit: 3,
      windowSeconds: TOTP_STEP_TTL_SECONDS,
      lockSeconds: TOTP_STEP_TTL_SECONDS,
    });
    expect(policies.loginEmail).toEqual({
      name: 'login-email',
      limit: 50,
      windowSeconds: 3600,
      lockSeconds: 3600,
    });
    expect(policies.totpUser).toEqual({
      name: 'totp-user',
      limit: 10,
      windowSeconds: 900,
      lockSeconds: 900,
      exponential: true,
    });
    expect(policies.mailRecipient).toEqual({
      name: 'mail-recipient',
      limit: 3,
      windowSeconds: 3600,
      lockSeconds: 3600,
    });
    expect(policies.kidPin).toEqual({
      name: 'kid-pin',
      limit: 6,
      windowSeconds: 600,
      lockSeconds: 600,
      exponential: true,
    });
  });
});
