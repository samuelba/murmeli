import { HttpException } from '@nestjs/common';
import { RetryAfterException } from '../../../common/errors/api-exception';
import { UserEntity } from '../../users/user.entity';
import { TotpSecretEntity } from '../entities/totp-secret.entity';
import { createTotpCipher } from './totp-cipher';
import { generateCode } from './totp-codes';
import { TotpService } from './totp.service';

const KEY = 'enc-Key-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ-xyz';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const actor = { userId: 'user-1', ip: '192.0.2.4' };

interface Row {
  secretEncrypted: string;
  confirmedAt: Date | null;
  lastUsedStep: number | null;
}

function setup(user: Partial<UserEntity> = {}, row?: Partial<Row>) {
  const store: { row: Row | null } = {
    row: row
      ? {
          secretEncrypted: createTotpCipher(KEY).encrypt(SECRET, 'user-1'),
          confirmedAt: new Date(),
          lastUsedStep: null,
          ...row,
        }
      : null,
  };
  const secrets = {
    upsert: jest.fn((value: Row) => {
      store.row = value;
    }),
    findOneBy: jest.fn((where: { confirmedAt: { type: string } }) => {
      const wantsConfirmed = where.confirmedAt.type === 'not';
      const matches =
        store.row !== null &&
        (store.row.confirmedAt !== null) === wantsConfirmed;
      return Promise.resolve(matches ? store.row : null);
    }),
  };
  const manager = { update: jest.fn(), delete: jest.fn() };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => unknown) =>
      work(manager),
    ),
    query: jest.fn(
      (_sql: string, [, step, confirmed]: [string, number, boolean]) => {
        const current = store.row;
        if (
          !current ||
          (current.confirmedAt !== null) !== confirmed ||
          (current.lastUsedStep !== null && current.lastUsedStep >= step)
        ) {
          return Promise.resolve([[], 0]);
        }
        current.lastUsedStep = step;
        return Promise.resolve([[{ user_id: 'user-1' }], 1]);
      },
    ),
  };
  const policies = { totpUser: { name: 'totp-user' } };
  const deps = {
    users: {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'parent@example.com',
        passwordHash: 'h',
        totpEnabled: false,
        ...user,
      }),
    },
    passwords: { verify: jest.fn().mockResolvedValue(true) },
    recoveryCodes: {
      replace: jest.fn().mockResolvedValue(['AAAA-BBBB-CCCC']),
      consume: jest.fn().mockResolvedValue(false),
      removeAll: jest.fn(),
    },
    audit: { record: jest.fn() },
    limiter: {
      attempt: jest.fn().mockResolvedValue({
        allowed: true,
        retryAfterSeconds: 0,
        justLocked: false,
      }),
      succeed: jest.fn(),
    },
  };
  const config = { get: jest.fn().mockReturnValue(KEY) };
  const service = new TotpService(
    secrets as never,
    dataSource as never,
    deps.users as never,
    deps.passwords as never,
    deps.recoveryCodes as never,
    deps.audit as never,
    deps.limiter as never,
    policies as never,
    config as never,
  );
  return { service, store, secrets, manager, dataSource, policies, ...deps };
}

async function errorCode(promise: Promise<unknown>): Promise<unknown> {
  const error = (await promise.catch(
    (caught: unknown) => caught,
  )) as HttpException;
  return (error.getResponse() as { errorCode: string }).errorCode;
}

describe('TotpService.setup', () => {
  it('stores a new encrypted, unconfirmed secret and returns a QR code', async () => {
    const { service, store } = setup();

    const result = await service.setup('user-1');

    expect(result.otpauthUrl).toContain('parent%40example.com');
    expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const secret = new URL(result.otpauthUrl).searchParams.get('secret') ?? '';
    expect(store.row?.secretEncrypted).not.toContain(secret);
    expect(
      createTotpCipher(KEY).decrypt(store.row?.secretEncrypted ?? '', 'user-1'),
    ).toBe(secret);
    expect(() =>
      createTotpCipher(KEY).decrypt(store.row?.secretEncrypted ?? '', 'user-2'),
    ).toThrow();
    expect(store.row).toMatchObject({ confirmedAt: null, lastUsedStep: null });
  });

  it('refuses while TOTP is enabled', async () => {
    const { service } = setup({ totpEnabled: true });

    expect(await errorCode(service.setup('user-1'))).toBe(
      'TOTP_ALREADY_ENABLED',
    );
  });

  it('requires an existing user', async () => {
    const { service, users } = setup();
    users.findById.mockResolvedValue(null);

    expect(await errorCode(service.setup('user-1'))).toBe('UNAUTHORIZED');
  });
});

describe('TotpService.enable', () => {
  it('confirms the pending secret and returns recovery codes', async () => {
    const { service, manager, audit } = setup({}, { confirmedAt: null });

    await expect(service.enable(actor, generateCode(SECRET))).resolves.toEqual([
      'AAAA-BBBB-CCCC',
    ]);
    expect(manager.update).toHaveBeenCalledWith(
      TotpSecretEntity,
      { userId: 'user-1' },
      { confirmedAt: expect.any(Date) },
    );
    expect(manager.update).toHaveBeenCalledWith(
      UserEntity,
      { id: 'user-1' },
      { totpEnabled: true },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.totp_enabled', ip: actor.ip }),
    );
  });

  it('rejects a wrong code', async () => {
    const { service } = setup({}, { confirmedAt: null });

    expect(await errorCode(service.enable(actor, '000000'))).toBe(
      'TOTP_INVALID',
    );
  });

  it('rejects when no setup is pending', async () => {
    const { service } = setup({}, {});

    expect(await errorCode(service.enable(actor, generateCode(SECRET)))).toBe(
      'TOTP_INVALID',
    );
  });
});

describe('TotpService.consumeCode', () => {
  it('accepts a code once and rejects its replay', async () => {
    const { service } = setup({ totpEnabled: true }, {});
    const code = generateCode(SECRET);

    await expect(service.consumeCode('user-1', code, true)).resolves.toBe(true);
    await expect(service.consumeCode('user-1', code, true)).resolves.toBe(
      false,
    );
  });

  it('rejects without a stored secret', async () => {
    const { service, dataSource } = setup();

    await expect(
      service.consumeCode('user-1', generateCode(SECRET), true),
    ).resolves.toBe(false);
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});

describe('TotpService.disable', () => {
  const enabled = { totpEnabled: true };

  it('removes secret and codes after password and code check', async () => {
    const { service, manager, recoveryCodes, audit } = setup(enabled, {});

    await service.disable(actor, 'pw', generateCode(SECRET));

    expect(manager.delete).toHaveBeenCalledWith(TotpSecretEntity, {
      userId: 'user-1',
    });
    expect(recoveryCodes.removeAll).toHaveBeenCalledWith('user-1', manager);
    expect(manager.update).toHaveBeenCalledWith(
      UserEntity,
      { id: 'user-1' },
      { totpEnabled: false },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.totp_disabled' }),
    );
  });

  it('accepts a recovery code instead of a TOTP code', async () => {
    const { service, recoveryCodes, manager } = setup(enabled, {});
    recoveryCodes.consume.mockResolvedValue(true);

    await service.disable(actor, 'pw', 'AAAA-BBBB-CCCC');

    expect(recoveryCodes.consume).toHaveBeenCalledWith(
      'user-1',
      'AAAA-BBBB-CCCC',
    );
    expect(manager.delete).toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    const { service, passwords } = setup(enabled, {});
    passwords.verify.mockResolvedValue(false);

    expect(await errorCode(service.disable(actor, 'bad', '123456'))).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it.each([
    ['a wrong code', enabled],
    ['TOTP that is not enabled', { totpEnabled: false }],
  ])('rejects %s', async (_name, user) => {
    const { service, manager } = setup(user, {});

    expect(await errorCode(service.disable(actor, 'pw', '000000'))).toBe(
      'TOTP_INVALID',
    );
    expect(manager.delete).not.toHaveBeenCalled();
  });
});

describe('TotpService.regenerateRecoveryCodes', () => {
  it('replaces the codes for a valid TOTP code', async () => {
    const { service, recoveryCodes } = setup({ totpEnabled: true }, {});

    await expect(
      service.regenerateRecoveryCodes('user-1', generateCode(SECRET)),
    ).resolves.toEqual(['AAAA-BBBB-CCCC']);
    expect(recoveryCodes.replace).toHaveBeenCalledWith('user-1');
  });

  it('rejects a wrong code', async () => {
    const { service } = setup({ totpEnabled: true }, {});

    expect(
      await errorCode(service.regenerateRecoveryCodes('user-1', '000000')),
    ).toBe('TOTP_INVALID');
  });
});

describe('TotpService.checkWithLimit', () => {
  it('runs the check under the per-user limit and refunds on success', async () => {
    const { service, limiter, policies } = setup();

    await expect(
      service.checkWithLimit('user-1', () => Promise.resolve(true)),
    ).resolves.toBe(true);
    expect(limiter.attempt).toHaveBeenCalledWith(policies.totpUser, 'user-1');
    expect(limiter.succeed).toHaveBeenCalledWith(policies.totpUser, 'user-1');
  });

  it('keeps a failed check counted', async () => {
    const { service, limiter } = setup();

    await expect(
      service.checkWithLimit('user-1', () => Promise.resolve(false)),
    ).resolves.toBe(false);
    expect(limiter.succeed).not.toHaveBeenCalled();
  });

  it('refuses with 429 while locked, without running the check', async () => {
    const { service, limiter } = setup();
    limiter.attempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 900,
      justLocked: false,
    });
    const check = jest.fn();

    const error = await service
      .checkWithLimit('user-1', check)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RetryAfterException);
    expect((error as RetryAfterException).retryAfterSeconds).toBe(900);
    expect(check).not.toHaveBeenCalled();
  });

  it.each([
    [
      'enable',
      (s: TotpService) => s.enable(actor, '000000'),
      { totpEnabled: false },
      { confirmedAt: null },
    ],
    [
      'disable',
      (s: TotpService) => s.disable(actor, 'pw', '000000'),
      { totpEnabled: true },
      {},
    ],
    [
      'recovery-code regeneration',
      (s: TotpService) => s.regenerateRecoveryCodes('user-1', '000000'),
      { totpEnabled: true },
      {},
    ],
  ])('guards %s', async (_name, run, user, row) => {
    const { service, limiter } = setup(user, row);
    limiter.attempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
      justLocked: false,
    });

    await expect(run(service)).rejects.toBeInstanceOf(RetryAfterException);
  });
});

describe('TotpService.consumeCode confirmation state', () => {
  it('does not accept a confirmed secret during enable', async () => {
    const { service } = setup({}, {});

    await expect(
      service.consumeCode('user-1', generateCode(SECRET), false),
    ).resolves.toBe(false);
  });
});
