import { HttpException, Logger } from '@nestjs/common';
import { UserEntity } from '../../users/user.entity';
import {
  OPEN_SETUP_WARNING,
  SETUP_LOCK_ID,
  SetupService,
} from './setup.service';

const dto = {
  email: 'admin@example.com',
  password: 'correct-horse-battery',
  locale: 'de-CH' as const,
};

interface Options {
  readonly token?: string;
  readonly nodeEnv?: string;
}

function setup(existingUsers = 0, countInLock = 0, options: Options = {}) {
  const manager = {
    query: jest.fn(),
    count: jest.fn().mockResolvedValue(countInLock),
  };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => unknown) =>
      work(manager),
    ),
  };
  const users = {
    count: jest.fn().mockResolvedValue(existingUsers),
    create: jest.fn().mockResolvedValue({ id: 'admin-1' }),
  };
  const passwords = {
    assertAcceptable: jest.fn(),
    hash: jest.fn().mockResolvedValue('argon2id$hash'),
  };
  const env: Record<string, unknown> = {
    SETUP_TOKEN: options.token,
    NODE_ENV: options.nodeEnv ?? 'test',
  };
  const service = new SetupService(
    dataSource as never,
    users as never,
    passwords as never,
    { get: (key: string) => env[key] } as never,
  );
  return { service, manager, users, passwords };
}

function errorCode(error: unknown): unknown {
  return ((error as HttpException).getResponse() as { errorCode: string })
    .errorCode;
}

describe('SetupService', () => {
  it('is required only while there are no users', async () => {
    await expect(setup(0).service.isRequired()).resolves.toBe(true);
    await expect(setup(2).service.isRequired()).resolves.toBe(false);
  });

  it('creates a verified admin under an advisory lock', async () => {
    const { service, manager, users } = setup();

    await expect(service.createFirstAdmin(dto)).resolves.toEqual({
      id: 'admin-1',
    });

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1)',
      [SETUP_LOCK_ID],
    );
    expect(manager.count).toHaveBeenCalledWith(UserEntity);
    expect(users.create).toHaveBeenCalledWith(
      {
        email: dto.email,
        passwordHash: 'argon2id$hash',
        locale: 'de-CH',
        role: 'admin',
        emailVerifiedAt: expect.any(Date),
      },
      manager,
    );
  });

  it('refuses once a user exists', async () => {
    const { service, passwords } = setup(1);

    expect(
      errorCode(await service.createFirstAdmin(dto).catch((e: unknown) => e)),
    ).toBe('SETUP_COMPLETE');
    expect(passwords.hash).not.toHaveBeenCalled();
  });

  it('refuses when a concurrent setup won the lock', async () => {
    const { service, users } = setup(0, 1);

    expect(
      errorCode(await service.createFirstAdmin(dto).catch((e: unknown) => e)),
    ).toBe('SETUP_COMPLETE');
    expect(users.create).not.toHaveBeenCalled();
  });

  describe('setup token', () => {
    const token = 'setup-Token-0123456789';

    it('is not required without SETUP_TOKEN', () => {
      expect(setup().service.tokenRequired).toBe(false);
      expect(setup(0, 0, { token }).service.tokenRequired).toBe(true);
    });

    it.each([
      ['missing', undefined],
      ['wrong', 'nope'],
      ['a prefix', token.slice(0, 5)],
    ])('rejects a %s token', async (_name, provided) => {
      const { service, passwords } = setup(0, 0, { token });

      const error = await service
        .createFirstAdmin({ ...dto, setupToken: provided })
        .catch((e: unknown) => e);

      expect(errorCode(error)).toBe('SETUP_TOKEN_INVALID');
      expect((error as HttpException).getStatus()).toBe(403);
      expect(passwords.hash).not.toHaveBeenCalled();
    });

    it('accepts the right token', async () => {
      const { service, users } = setup(0, 0, { token });

      await service.createFirstAdmin({ ...dto, setupToken: token });

      expect(users.create).toHaveBeenCalled();
    });

    it('still reports SETUP_COMPLETE first once a user exists', async () => {
      const { service } = setup(1, 0, { token });

      expect(
        errorCode(await service.createFirstAdmin(dto).catch((e: unknown) => e)),
      ).toBe('SETUP_COMPLETE');
    });
  });

  describe('startup warning', () => {
    afterEach(() => jest.restoreAllMocks());

    it('warns in production while setup is open to anyone', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await setup(0, 0, {
        nodeEnv: 'production',
      }).service.onApplicationBootstrap();

      expect(warn).toHaveBeenCalledWith(OPEN_SETUP_WARNING);
    });

    it.each([
      ['outside production', 0, { nodeEnv: 'development' }],
      ['with a setup token', 0, { nodeEnv: 'production', token: 't' }],
      ['once a user exists', 1, { nodeEnv: 'production' }],
    ])('stays quiet %s', async (_name, users, options) => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await setup(users, 0, options).service.onApplicationBootstrap();

      expect(warn).not.toHaveBeenCalled();
    });

    it('logs when the users cannot be counted', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const { service, users } = setup(0, 0, { nodeEnv: 'production' });
      users.count.mockRejectedValue(new Error('db down'));

      await service.onApplicationBootstrap();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
    });
  });
});
