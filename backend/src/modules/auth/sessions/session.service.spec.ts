import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { sha256Hex } from '../../../common/crypto/secure-token';
import type { Env } from '../../../config/env.schema';
import type { RefreshTokenEntity } from '../entities/refresh-token.entity';
import {
  ACTIVE_CACHE_SECONDS,
  FAMILY_CACHE_PREFIX,
  REVOKED_CACHE_SECONDS,
  SessionService,
} from './session.service';

const USER = { id: 'user-1', role: 'parent', disabled: false };

function stored(
  overrides: Partial<RefreshTokenEntity> = {},
): RefreshTokenEntity {
  return {
    id: 'token-1',
    userId: USER.id,
    familyId: 'fam-1',
    tokenHash: 'hash',
    revoked: false,
    revokedReason: null,
    replacedBy: null,
    userAgent: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    user: { ...USER } as RefreshTokenEntity['user'],
    ...overrides,
  };
}

function setup() {
  const managerRepo = {
    insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'token-2' }] }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const tokens = {
    insert: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const query = jest.fn();
  const dataSource = {
    query,
    manager: { query },
    transaction: jest.fn((work: (manager: unknown) => Promise<unknown>) =>
      work({ getRepository: () => managerRepo }),
    ),
  };
  const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
  const service = new SessionService(
    tokens as never,
    dataSource as never,
    redis,
    { get: () => '30d' } as unknown as ConfigService<Env, true>,
  );
  return { service, tokens, dataSource, redis, managerRepo };
}

describe('SessionService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('start', () => {
    it('stores only the hash of a new refresh token in a new family', async () => {
      const { service, tokens } = setup();

      const session = await service.start('user-1', 'Firefox');

      expect(tokens.insert).toHaveBeenCalledWith({
        userId: 'user-1',
        familyId: session.familyId,
        tokenHash: sha256Hex(session.refreshToken),
        userAgent: 'Firefox',
        expiresAt: session.refreshExpiresAt,
      });
      expect(session.refreshToken).toMatch(/^[\w-]{43}$/);
      const days =
        (session.refreshExpiresAt.getTime() - Date.now()) / 86_400_000;
      expect(Math.round(days)).toBe(30);
    });

    it('starts a different family every time', async () => {
      const { service } = setup();

      const [a, b] = await Promise.all([
        service.start('u', null),
        service.start('u', null),
      ]);

      expect(a.familyId).not.toBe(b.familyId);
    });
  });

  describe('rotate', () => {
    it('looks the token up by its hash', async () => {
      const { service, tokens } = setup();
      tokens.findOne.mockResolvedValue(null);

      await expect(service.rotate('raw', null)).resolves.toEqual({
        status: 'expired',
      });
      expect(tokens.findOne).toHaveBeenCalledWith({
        where: { tokenHash: sha256Hex('raw') },
        relations: { user: true },
      });
    });

    it('treats an expired token as expired', async () => {
      const { service, tokens } = setup();
      tokens.findOne.mockResolvedValue(
        stored({ expiresAt: new Date(Date.now() - 1) }),
      );

      await expect(service.rotate('raw', null)).resolves.toEqual({
        status: 'expired',
      });
    });

    it('rotates: inserts the successor and revokes the old token atomically', async () => {
      const { service, tokens, managerRepo } = setup();
      tokens.findOne.mockResolvedValue(stored());

      const result = await service.rotate('raw', 'Safari');

      expect(result.status).toBe('rotated');
      if (result.status !== 'rotated') {
        return;
      }
      expect(result.session.familyId).toBe('fam-1');
      expect(managerRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          familyId: 'fam-1',
          userAgent: 'Safari',
          tokenHash: sha256Hex(result.session.refreshToken),
        }),
      );
      expect(managerRepo.update).toHaveBeenCalledWith(
        { id: 'token-1', revoked: false },
        { revoked: true, revokedReason: 'rotated', replacedBy: 'token-2' },
      );
    });

    it('revokes the family when a rotated token is presented again', async () => {
      const { service, tokens, redis } = setup();
      tokens.findOne.mockResolvedValue(
        stored({ revoked: true, revokedReason: 'rotated' }),
      );

      await expect(service.rotate('raw', null)).resolves.toEqual({
        status: 'compromised',
        userId: 'user-1',
      });
      expect(tokens.update).toHaveBeenCalledWith(
        { familyId: 'fam-1', revoked: false },
        { revoked: true, revokedReason: 'compromised' },
      );
      expect(redis.set).toHaveBeenCalledWith(
        `${FAMILY_CACHE_PREFIX}fam-1`,
        '0',
        'EX',
        REVOKED_CACHE_SECONDS,
      );
    });

    it('treats a token revoked for another reason as expired', async () => {
      const { service, tokens } = setup();
      tokens.findOne.mockResolvedValue(
        stored({ revoked: true, revokedReason: 'logout' }),
      );

      await expect(service.rotate('raw', null)).resolves.toEqual({
        status: 'expired',
      });
      expect(tokens.update).not.toHaveBeenCalled();
    });

    it('revokes the family of a disabled user', async () => {
      const { service, tokens } = setup();
      tokens.findOne.mockResolvedValue(
        stored({ user: { ...USER, disabled: true } as never }),
      );

      await expect(service.rotate('raw', null)).resolves.toEqual({
        status: 'expired',
      });
      expect(tokens.update).toHaveBeenCalledWith(
        { familyId: 'fam-1', revoked: false },
        { revoked: true, revokedReason: 'disabled' },
      );
    });

    it('treats a concurrent rotation as theft', async () => {
      const { service, tokens, managerRepo } = setup();
      tokens.findOne.mockResolvedValue(stored());
      managerRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.rotate('raw', null)).resolves.toEqual({
        status: 'compromised',
        userId: 'user-1',
      });
    });

    it('rethrows database errors', async () => {
      const { service, tokens, managerRepo } = setup();
      tokens.findOne.mockResolvedValue(stored());
      managerRepo.insert.mockRejectedValue(new Error('db down'));

      await expect(service.rotate('raw', null)).rejects.toThrow('db down');
    });
  });

  it('finds a family by the raw token', async () => {
    const { service, tokens } = setup();
    tokens.findOneBy.mockResolvedValue(stored());

    await expect(service.findFamily('raw')).resolves.toMatchObject({
      familyId: 'fam-1',
    });
    expect(tokens.findOneBy).toHaveBeenCalledWith({
      tokenHash: sha256Hex('raw'),
    });
  });

  describe('revokeUserSessions', () => {
    it('revokes every other family and caches them as revoked', async () => {
      const { service, dataSource, redis } = setup();
      dataSource.query.mockResolvedValue([
        [{ family_id: 'a' }, { family_id: 'a' }, { family_id: 'b' }],
        3,
      ]);

      await service.revokeUserSessions('user-1', 'password_changed', 'keep');

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "refresh_tokens"'),
        ['user-1', 'password_changed', 'keep'],
      );
      expect(redis.set).toHaveBeenCalledTimes(2);
    });

    it('passes null when no family is kept', async () => {
      const { service, dataSource } = setup();
      dataSource.query.mockResolvedValue([[], 0]);

      await service.revokeUserSessions('user-1', 'disabled');

      expect(dataSource.query.mock.calls[0][1]).toEqual([
        'user-1',
        'disabled',
        null,
      ]);
    });
  });

  describe('revokeUserSessionsIn', () => {
    it('runs inside the given transaction and returns the distinct families', async () => {
      const { service, dataSource, redis } = setup();
      const manager = {
        query: jest
          .fn()
          .mockResolvedValue([
            [{ family_id: 'a' }, { family_id: 'a' }, { family_id: 'b' }],
            3,
          ]),
      };

      await expect(
        service.revokeUserSessionsIn(manager, 'user-1', 'deleted'),
      ).resolves.toEqual(['a', 'b']);
      expect(manager.query.mock.calls[0][1]).toEqual([
        'user-1',
        'deleted',
        null,
      ]);
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('markRevoked', () => {
    it('caches every family as revoked', async () => {
      const { service, redis } = setup();

      await service.markRevoked(['a', 'b']);

      expect(redis.set).toHaveBeenCalledWith(
        `${FAMILY_CACHE_PREFIX}a`,
        '0',
        'EX',
        expect.any(Number),
      );
      expect(redis.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('isFamilyActive', () => {
    it.each([
      ['1', true],
      ['0', false],
    ])('trusts the cache value %p', async (value, expected) => {
      const { service, redis, dataSource } = setup();
      redis.get.mockResolvedValue(value);

      await expect(service.isFamilyActive('fam-1')).resolves.toBe(expected);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('asks the database on a miss and caches an active family without overwriting', async () => {
      const { service, redis, dataSource } = setup();
      dataSource.query.mockResolvedValue([{ active: true }]);

      await expect(service.isFamilyActive('fam-1')).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        `${FAMILY_CACHE_PREFIX}fam-1`,
        '1',
        'EX',
        ACTIVE_CACHE_SECONDS,
        'NX',
      );
    });

    it('reports a family without rows as inactive', async () => {
      const { service, dataSource } = setup();
      dataSource.query.mockResolvedValue([]);

      await expect(service.isFamilyActive('fam-1')).resolves.toBe(false);
    });

    it('falls back to the database when Redis is down', async () => {
      const { service, redis, dataSource } = setup();
      redis.get.mockRejectedValue(new Error('down'));
      redis.set.mockRejectedValue(new Error('down'));
      dataSource.query.mockResolvedValue([{ active: true }]);

      await expect(service.isFamilyActive('fam-1')).resolves.toBe(true);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Family cache unavailable'),
      );
    });
  });
});
