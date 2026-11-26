import { type ExecutionContext, HttpException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth.types';
import { PARENT_GATE_REQUIRED, ParentGateGuard } from './parent-gate.guard';

const AUTH = { userId: 'user-1', familyId: 'fam-1' };

function context(request: Partial<AuthenticatedRequest>, response = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function setup(claims: unknown) {
  const tokens = { verify: jest.fn().mockReturnValue(claims) };
  const issuer = { openParentGate: jest.fn() };
  return {
    guard: new ParentGateGuard(tokens as never, issuer as never),
    tokens,
    issuer,
  };
}

function rejection(run: () => unknown): [number, unknown] {
  try {
    run();
  } catch (error) {
    const http = error as HttpException;
    return [
      http.getStatus(),
      (http.getResponse() as { errorCode: string }).errorCode,
    ];
  }
  throw new Error('expected a rejection');
}

describe('ParentGateGuard', () => {
  it('requires an authenticated request', () => {
    const { guard } = setup(null);

    expect(rejection(() => guard.canActivate(context({})))).toEqual([
      401,
      'UNAUTHORIZED',
    ]);
  });

  it.each([
    ['no gate cookie', null],
    ['another user', { sub: 'user-2', fam: 'fam-1' }],
    ['another family', { sub: 'user-1', fam: 'fam-2' }],
  ])('rejects %s with 403 PARENT_GATE_REQUIRED', (_name, claims) => {
    const { guard } = setup(claims);

    expect(
      rejection(() =>
        guard.canActivate(context({ auth: AUTH, cookies: { mu_pg: 'gate' } })),
      ),
    ).toEqual([403, PARENT_GATE_REQUIRED]);
  });

  it('accepts a matching gate and renews it', () => {
    const response = {};
    const { guard, tokens, issuer } = setup({
      sub: 'user-1',
      fam: 'fam-1',
      ath: 1234,
    });

    expect(
      guard.canActivate(
        context({ auth: AUTH, cookies: { mu_pg: 'gate' } }, response),
      ),
    ).toBe(true);
    expect(tokens.verify).toHaveBeenCalledWith('parent_gate', 'gate');
    expect(issuer.openParentGate).toHaveBeenCalledWith(
      response,
      'user-1',
      'fam-1',
      1234,
    );
  });
});
