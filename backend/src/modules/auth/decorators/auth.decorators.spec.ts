import { type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../guards/admin.guard';
import { ParentGateGuard } from '../guards/parent-gate.guard';
import {
  AdminOnly,
  CurrentAuth,
  RequireParentGate,
  currentAuth,
} from './auth.decorators';

@RequireParentGate()
class Gated {}

@AdminOnly()
class AdminRoutes {}

class WithParam {
  handler(@CurrentAuth() _auth: unknown): void {}
}

describe('auth decorators', () => {
  it('RequireParentGate applies the ParentGateGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, Gated)).toEqual([
      ParentGateGuard,
    ]);
  });

  it('AdminOnly checks the role before the parent gate', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminRoutes)).toEqual([
      AdminGuard,
      ParentGateGuard,
    ]);
  });

  it('currentAuth reads the auth context of the request', () => {
    const auth = { userId: 'u', role: 'admin', familyId: 'f' };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    } as unknown as ExecutionContext;

    expect(currentAuth(context)).toBe(auth);
  });

  it('CurrentAuth resolves the auth context as a route parameter', () => {
    const auth = { userId: 'u', role: 'parent', familyId: 'f' };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    } as unknown as ExecutionContext;
    const args = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      WithParam,
      'handler',
    ) as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => unknown }
    >;

    const [param] = Object.values(args);

    expect(param.factory(undefined, context)).toBe(auth);
  });
});
