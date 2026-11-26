import { Controller, ExecutionContext, Post } from '@nestjs/common';
import {
  normalizeIp,
  type ThrottlerOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import {
  AUTH_THROTTLER,
  AuthThrottle,
  EMAIL_THROTTLER,
  EmailThrottle,
  FAIL_CLOSED_THROTTLERS,
} from './auth-throttle.decorator';
import {
  buildThrottlerOptions,
  isAuthThrottled,
  isEmailThrottled,
} from './throttler.options';

@Controller()
class PlainController {
  @Post()
  plain(): void {}

  @AuthThrottle()
  @Post()
  login(): void {}

  @EmailThrottle()
  @Post()
  register(): void {}
}

@AuthThrottle()
@Controller()
class AuthController {
  @Post()
  register(): void {}
}

function context(
  classRef: new () => object,
  handler: () => void,
): ExecutionContext {
  return {
    getClass: () => classRef,
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

describe('isAuthThrottled', () => {
  it.each([
    [
      'an unmarked route',
      PlainController,
      PlainController.prototype.plain,
      false,
    ],
    ['a marked route', PlainController, PlainController.prototype.login, true],
    [
      'a route of a marked controller',
      AuthController,
      AuthController.prototype.register,
      true,
    ],
  ])('%s -> %p', (_label, classRef, handler, expected) => {
    expect(isAuthThrottled(context(classRef, handler))).toBe(expected);
  });
});

describe('buildThrottlerOptions', () => {
  const storage = {} as ThrottlerStorage;
  const options = buildThrottlerOptions(
    {
      RATE_LIMIT_TTL_SECONDS: 60,
      RATE_LIMIT_LIMIT: 120,
      RATE_LIMIT_AUTH_TTL_SECONDS: 300,
      RATE_LIMIT_AUTH_LIMIT: 10,
      RATE_LIMIT_EMAIL_TTL_SECONDS: 3600,
      RATE_LIMIT_EMAIL_LIMIT: 5,
    },
    storage,
  ) as {
    storage: ThrottlerStorage;
    ipv6SubnetPrefix: number;
    throttlers: ThrottlerOptions[];
  };

  it('tracks IPv6 clients by /64 and IPv4 clients by address', () => {
    expect(options.ipv6SubnetPrefix).toBe(64);
    expect(normalizeIp('2001:db8:1:2:aaaa::1', options.ipv6SubnetPrefix)).toBe(
      normalizeIp('2001:db8:1:2:bbbb::9', options.ipv6SubnetPrefix),
    );
    expect(normalizeIp('203.0.113.7', options.ipv6SubnetPrefix)).toBe(
      '203.0.113.7',
    );
    expect(normalizeIp('::ffff:203.0.113.7', options.ipv6SubnetPrefix)).toBe(
      '203.0.113.7',
    );
  });

  it('uses the given storage', () => {
    expect(options.storage).toBe(storage);
  });

  it('defines a default and an opt-in auth throttler in milliseconds', () => {
    const [defaults, auth] = options.throttlers;

    expect(defaults).toEqual({ name: 'default', ttl: 60_000, limit: 120 });
    expect(auth).toMatchObject({ name: 'auth', ttl: 300_000, limit: 10 });
    expect(
      auth.skipIf?.(context(PlainController, PlainController.prototype.plain)),
    ).toBe(true);
    expect(
      auth.skipIf?.(context(PlainController, PlainController.prototype.login)),
    ).toBe(false);
  });

  it('defines an opt-in email throttler', () => {
    const email = options.throttlers[2];

    expect(email).toMatchObject({ name: 'email', ttl: 3_600_000, limit: 5 });
    expect(
      email.skipIf?.(context(PlainController, PlainController.prototype.login)),
    ).toBe(true);
    expect(
      email.skipIf?.(
        context(PlainController, PlainController.prototype.register),
      ),
    ).toBe(false);
  });
});

describe('isEmailThrottled', () => {
  it('is true only for routes marked with @EmailThrottle()', () => {
    expect(
      isEmailThrottled(
        context(PlainController, PlainController.prototype.register),
      ),
    ).toBe(true);
    expect(
      isEmailThrottled(
        context(PlainController, PlainController.prototype.plain),
      ),
    ).toBe(false);
  });
});

describe('FAIL_CLOSED_THROTTLERS', () => {
  it('contains the auth and email throttlers only', () => {
    expect([...FAIL_CLOSED_THROTTLERS].sort()).toEqual(
      [AUTH_THROTTLER, EMAIL_THROTTLER].sort(),
    );
  });
});
