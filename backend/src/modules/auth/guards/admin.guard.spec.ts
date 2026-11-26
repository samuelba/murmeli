import { type ExecutionContext, HttpException } from '@nestjs/common';
import { AdminGuard, TOTP_REQUIRED } from './admin.guard';

const AUTH = { userId: 'user-1', role: 'admin' as const, familyId: 'fam-1' };

function context(auth: unknown = AUTH): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as unknown as ExecutionContext;
}

function setup(user: unknown, totpRequired = false) {
  const users = { findById: jest.fn().mockResolvedValue(user) };
  const settings = {
    isAdminTotpRequired: jest.fn().mockResolvedValue(totpRequired),
  };
  return {
    guard: new AdminGuard(users as never, settings as never),
    users,
    settings,
  };
}

async function failure(promise: Promise<unknown>): Promise<[number, unknown]> {
  const error = (await promise.catch((e: unknown) => e)) as HttpException;
  return [
    error.getStatus(),
    (error.getResponse() as { errorCode: string }).errorCode,
  ];
}

const admin = {
  id: 'user-1',
  role: 'admin',
  disabled: false,
  totpEnabled: false,
};

describe('AdminGuard', () => {
  it('requires an authenticated request', async () => {
    await expect(
      failure(setup(admin).guard.canActivate(context(null))),
    ).resolves.toEqual([401, 'UNAUTHORIZED']);
  });

  it.each([
    ['a missing user', null],
    ['a parent', { ...admin, role: 'parent' }],
    ['a disabled admin', { ...admin, disabled: true }],
  ])('rejects %s with 403 FORBIDDEN', async (_name, user) => {
    await expect(
      failure(setup(user).guard.canActivate(context())),
    ).resolves.toEqual([403, 'FORBIDDEN']);
  });

  it('checks the role in the database, not the token', async () => {
    const { guard, users } = setup(admin);

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(users.findById).toHaveBeenCalledWith('user-1');
  });

  it('requires TOTP when the setting is on', async () => {
    await expect(
      failure(setup(admin, true).guard.canActivate(context())),
    ).resolves.toEqual([403, TOTP_REQUIRED]);
  });

  it('lets admins with TOTP through when the setting is on', async () => {
    const { guard, settings } = setup({ ...admin, totpEnabled: true }, true);

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(settings.isAdminTotpRequired).not.toHaveBeenCalled();
  });
});
