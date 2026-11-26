import { Controller, ExecutionContext, Post } from '@nestjs/common';
import {
  normalizeIp,
  type ThrottlerOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { AuthThrottle } from './auth-throttle.decorator';
import { buildThrottlerOptions, isAuthThrottled } from './throttler.options';

@Controller()
class PlainController {
  @Post()
  plain(): void {}

  @AuthThrottle()
  @Post()
  login(): void {}
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
});
