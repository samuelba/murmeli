import {
  Controller,
  ExecutionContext,
  Logger,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, type ThrottlerStorage } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';
import { AuthThrottle, EmailThrottle } from './auth-throttle.decorator';
import { buildThrottlerOptions } from './throttler.options';

@Controller()
class RoutesController {
  @Post()
  plain(): void {}

  @AuthThrottle()
  @Post()
  login(): void {}

  @EmailThrottle()
  @Post()
  register(): void {}
}

function context(handler: () => void, res = { header: jest.fn() }) {
  return {
    res,
    context: {
      getClass: () => RoutesController,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ ip: '203.0.113.7', headers: {} }),
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext,
  };
}

function guard(increment: jest.Mock): AppThrottlerGuard {
  const storage: ThrottlerStorage = { increment };
  return new AppThrottlerGuard(
    buildThrottlerOptions(
      {
        RATE_LIMIT_TTL_SECONDS: 60,
        RATE_LIMIT_LIMIT: 2,
        RATE_LIMIT_AUTH_TTL_SECONDS: 300,
        RATE_LIMIT_AUTH_LIMIT: 1,
        RATE_LIMIT_EMAIL_TTL_SECONDS: 3600,
        RATE_LIMIT_EMAIL_LIMIT: 5,
      },
      storage,
    ),
    storage,
    new Reflector(),
  );
}

const allowed = {
  totalHits: 1,
  timeToExpire: 60,
  isBlocked: false,
  timeToBlockExpire: 0,
};

describe('AppThrottlerGuard', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('allows requests under the limit', async () => {
    const increment = jest.fn().mockResolvedValue(allowed);
    const { context: ctx } = context(RoutesController.prototype.login);

    await expect(guard(increment).canActivate(ctx)).resolves.toBe(true);
    expect(increment).toHaveBeenCalledTimes(2);
  });

  it('rejects blocked requests with 429 and a Retry-After header', async () => {
    const increment = jest.fn().mockResolvedValue({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 42,
    });
    const { context: ctx, res } = context(RoutesController.prototype.plain);

    await expect(guard(increment).canActivate(ctx)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
    expect(res.header).toHaveBeenCalledWith('Retry-After', 42);
  });

  it('fails open for ordinary routes when the store is down', async () => {
    const increment = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { context: ctx } = context(RoutesController.prototype.plain);

    await expect(guard(increment).canActivate(ctx)).resolves.toBe(true);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('allowing request (default)'),
    );
  });

  it('fails closed for auth routes when the store is down', async () => {
    const increment = jest
      .fn()
      .mockImplementation((_k, _t, _l, _b, name: string) =>
        name === 'auth'
          ? Promise.reject(new Error('ECONNREFUSED'))
          : Promise.resolve(allowed),
      );
    const { context: ctx } = context(RoutesController.prototype.login);

    const error = await guard(increment)
      .canActivate(ctx)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      errorCode: 'RATE_LIMIT_UNAVAILABLE',
    });
  });

  it('fails closed for email routes when the store is down', async () => {
    const increment = jest
      .fn()
      .mockImplementation((_k, _t, _l, _b, name: string) =>
        name === 'email'
          ? Promise.reject(new Error('ECONNREFUSED'))
          : Promise.resolve(allowed),
      );
    const { context: ctx } = context(RoutesController.prototype.register);

    await expect(guard(increment).canActivate(ctx)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('counts email routes against the default and email throttlers', async () => {
    const increment = jest.fn().mockResolvedValue(allowed);
    const { context: ctx } = context(RoutesController.prototype.register);

    await guard(increment).canActivate(ctx);

    expect(increment.mock.calls.map((call) => call[4] as string)).toEqual([
      'default',
      'email',
    ]);
  });
});
