import { HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthCookies } from '../auth/cookies/auth-cookies';
import type { TokenService } from '../auth/tokens/token.service';
import type { KidEntity } from '../kids/kid.entity';
import type { KidSessionService } from '../kids/kid-session.service';
import type { UserEntity } from '../users/user.entity';
import type { UsersService } from '../users/users.service';
import { AccountController } from './account.controller';
import type { AccountService } from './account.service';
import { MeController } from './me.controller';

const auth = { userId: 'u1', familyId: 'fam1' };
const request = {
  ip: '203.0.113.5',
  headers: {},
  cookies: { mu_pg: 'gate-jwt' },
} as unknown as Request;
const response = {} as Response;

const user = {
  id: 'u1',
  email: 'anna@example.com',
  role: 'parent',
  locale: 'de-CH',
  theme: null,
  emailVerifiedAt: new Date(),
  totpEnabled: false,
  disabled: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
} as UserEntity;

describe('AccountController', () => {
  const account = {
    changePassword: jest.fn().mockResolvedValue(undefined),
    requestEmailChange: jest.fn().mockResolvedValue(undefined),
    updatePreferences: jest.fn().mockResolvedValue({ id: 'u1' }),
    export: jest.fn().mockResolvedValue({ user: {} }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const cookies = { clearAll: jest.fn() };
  const controller = new AccountController(
    account as unknown as AccountService,
    cookies as unknown as AuthCookies,
  );
  const meta = { ip: '203.0.113.5', userAgent: null };

  it('changes the password', async () => {
    const dto = { currentPassword: 'a', newPassword: 'b'.repeat(10) };

    await expect(
      controller.changePassword(auth, dto, request),
    ).resolves.toEqual({
      ok: true,
    });
    expect(account.changePassword).toHaveBeenCalledWith(auth, dto, meta);
  });

  it('requests an email change', async () => {
    const dto = { newEmail: 'neu@example.com', password: 'pw' };

    await expect(controller.changeEmail(auth, dto)).resolves.toEqual({
      ok: true,
    });
    expect(account.requestEmailChange).toHaveBeenCalledWith(auth, dto);
  });

  it('wraps updated preferences in { user }', async () => {
    await expect(controller.update(auth, { theme: 'dark' })).resolves.toEqual({
      user: { id: 'u1' },
    });
  });

  it('exports the account', async () => {
    await expect(controller.export(auth)).resolves.toEqual({ user: {} });
    expect(account.export).toHaveBeenCalledWith('u1');
  });

  it('deletes the account and clears all cookies', async () => {
    await controller.delete(auth, { password: 'pw' }, response);

    expect(account.delete).toHaveBeenCalledWith(auth, 'pw');
    expect(cookies.clearAll).toHaveBeenCalledWith(response);
  });
});

describe('MeController', () => {
  function setup(
    found: UserEntity | null = user,
    kid: KidEntity | null = null,
  ) {
    const users = { findById: jest.fn().mockResolvedValue(found) };
    const tokens = { verify: jest.fn() };
    const kidSessions = { activeKid: jest.fn().mockResolvedValue(kid) };
    const controller = new MeController(
      users as unknown as UsersService,
      tokens as unknown as TokenService,
      kidSessions as unknown as KidSessionService,
    );
    return { controller, tokens };
  }

  it('returns the user with the gate expiry and active kid', async () => {
    const kid = {
      id: 'k1',
      nickname: 'Zoë',
      avatar: { animal: 'marmot', accessory: null, background: '#FFD8A8' },
      pinHash: null,
    } as KidEntity;
    const { controller, tokens } = setup(user, kid);
    tokens.verify.mockReturnValue({
      sub: 'u1',
      fam: 'fam1',
      exp: 1_800_000_000,
    });

    const me = await controller.me(auth, request);

    expect(tokens.verify).toHaveBeenCalledWith('parent_gate', 'gate-jwt');
    expect(me.user).toMatchObject({ id: 'u1', email: 'anna@example.com' });
    expect(me.parentGateExpiresAt).toBe(
      new Date(1_800_000_000_000).toISOString(),
    );
    expect(me.activeKid).toMatchObject({ id: 'k1', hasPin: false });
  });

  it.each([
    ['no gate', null],
    ['a gate of another family', { sub: 'u1', fam: 'other', exp: 1 }],
    ['a gate of another user', { sub: 'u2', fam: 'fam1', exp: 1 }],
  ])('reports a locked gate for %s', async (_label, claims) => {
    const { controller, tokens } = setup();
    tokens.verify.mockReturnValue(claims);

    const me = await controller.me(auth, request);

    expect(me.parentGateExpiresAt).toBeNull();
    expect(me.activeKid).toBeNull();
  });

  it.each([null, { ...user, disabled: true }])(
    'answers 401 UNAUTHORIZED for a missing or disabled user',
    async (found) => {
      const { controller } = setup(found);

      const error = await controller
        .me(auth, request)
        .catch((e: unknown) => e as HttpException);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        errorCode: 'UNAUTHORIZED',
      });
    },
  );
});
