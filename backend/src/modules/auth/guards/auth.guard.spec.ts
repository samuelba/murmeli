import { type ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../auth.types';
import { AuthGuard } from './auth.guard';

class Routes {
  @Public()
  open(): void {}

  closed(): void {}
}

function context(
  request: Partial<AuthenticatedRequest>,
  handler: () => void = Routes.prototype.closed,
  type = 'http',
): ExecutionContext {
  return {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function setup(claims: unknown = null, active = true) {
  const tokens = { verify: jest.fn().mockReturnValue(claims) };
  const sessions = { isFamilyActive: jest.fn().mockResolvedValue(active) };
  const guard = new AuthGuard(
    new Reflector(),
    tokens as never,
    sessions as never,
  );
  return { guard, tokens, sessions };
}

async function errorCode(promise: Promise<unknown>): Promise<unknown> {
  const error = (await promise.catch((e: unknown) => e)) as HttpException;
  expect(error).toBeInstanceOf(HttpException);
  return [
    error.getStatus(),
    (error.getResponse() as { errorCode: string }).errorCode,
  ];
}

describe('AuthGuard', () => {
  const claims = { sub: 'user-1', fam: 'fam-1', exp: 1 };

  it('lets non-http contexts through', async () => {
    await expect(
      setup().guard.canActivate(context({}, undefined, 'rpc')),
    ).resolves.toBe(true);
  });

  it('lets @Public() routes through without a cookie', async () => {
    const { guard, tokens } = setup();

    await expect(
      guard.canActivate(context({ cookies: {} }, Routes.prototype.open)),
    ).resolves.toBe(true);
    expect(tokens.verify).not.toHaveBeenCalled();
  });

  it('rejects a request without mu_at as UNAUTHORIZED', async () => {
    await expect(
      errorCode(setup().guard.canActivate(context({ cookies: {} }))),
    ).resolves.toEqual([401, 'UNAUTHORIZED']);
  });

  it('rejects an invalid token as UNAUTHORIZED', async () => {
    await expect(
      errorCode(
        setup(null).guard.canActivate(context({ cookies: { mu_at: 'x' } })),
      ),
    ).resolves.toEqual([401, 'UNAUTHORIZED']);
  });

  it('rejects a token of a revoked family', async () => {
    const { guard, sessions } = setup(claims, false);

    await expect(
      errorCode(guard.canActivate(context({ cookies: { mu_at: 'x' } }))),
    ).resolves.toEqual([401, 'UNAUTHORIZED']);
    expect(sessions.isFamilyActive).toHaveBeenCalledWith('fam-1');
  });

  it('attaches the auth context', async () => {
    const request: Partial<AuthenticatedRequest> = { cookies: { mu_at: 'x' } };

    await expect(
      setup(claims).guard.canActivate(context(request)),
    ).resolves.toBe(true);
    expect(request.auth).toEqual({ userId: 'user-1', familyId: 'fam-1' });
  });
});
