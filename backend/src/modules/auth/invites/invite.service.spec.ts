import { HttpException } from '@nestjs/common';
import { sha256Hex } from '../../../common/crypto/secure-token';
import type { InviteEntity } from '../entities/invite.entity';
import { InviteService, toInviteView } from './invite.service';

const CREATED = new Date('2026-11-26T10:00:00Z');
const EXPIRES = new Date('2026-12-03T10:00:00Z');

function invite(overrides: Partial<InviteEntity> = {}): InviteEntity {
  return {
    id: 'invite-1',
    email: 'guest@example.com',
    role: 'parent',
    tokenHash: 'hash',
    expiresAt: EXPIRES,
    acceptedAt: null,
    createdBy: 'admin-1',
    creator: { email: 'admin@example.com' },
    createdAt: CREATED,
    ...overrides,
  } as InviteEntity;
}

function setup() {
  const manager = {
    query: jest
      .fn()
      .mockResolvedValue([[{ email: 'guest@example.com', role: 'admin' }], 1]),
  };
  const deps = {
    invites: {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest
        .fn()
        .mockResolvedValue({ identifiers: [{ id: 'invite-1' }] }),
      findOneOrFail: jest.fn().mockResolvedValue(invite()),
      findAndCount: jest.fn().mockResolvedValue([[invite()], 1]),
      findOneBy: jest.fn().mockResolvedValue(invite()),
    },
    dataSource: {
      transaction: jest.fn((work: (m: typeof manager) => unknown) =>
        work(manager),
      ),
    },
    users: {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'user-9' }),
    },
    passwords: {
      assertAcceptable: jest.fn(),
      hash: jest.fn().mockResolvedValue('argon2id$hash'),
    },
    mailer: {
      invite: jest.fn().mockResolvedValue('queued'),
      inviteUrl: jest.fn((token: string) => `https://app/invite/${token}`),
    },
  };
  const service = new InviteService(
    deps.invites as never,
    deps.dataSource as never,
    deps.users as never,
    deps.passwords as never,
    deps.mailer as never,
  );
  return { service, manager, ...deps };
}

async function errorOf(promise: Promise<unknown>): Promise<HttpException> {
  return (await promise.catch((caught: unknown) => caught)) as HttpException;
}

describe('toInviteView', () => {
  it('shows the creator email, or null once the creator is gone', () => {
    expect(toInviteView(invite())).toEqual({
      id: 'invite-1',
      email: 'guest@example.com',
      role: 'parent',
      expiresAt: EXPIRES.toISOString(),
      createdAt: CREATED.toISOString(),
      createdBy: 'admin@example.com',
    });
    expect(toInviteView(invite({ creator: null })).createdBy).toBeNull();
  });
});

describe('InviteService.create', () => {
  it('stores a hashed token valid for seven days and mails the link', async () => {
    const { service, invites, mailer } = setup();
    const before = Date.now();

    const created = await service.create(
      'guest@example.com',
      'parent',
      'admin-1',
      'en-US',
    );

    expect(invites.delete).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'guest@example.com' }),
    );
    const row = invites.insert.mock.calls[0][0];
    const token = mailer.invite.mock.calls[0][1] as string;
    expect(row).toMatchObject({
      email: 'guest@example.com',
      role: 'parent',
      createdBy: 'admin-1',
      tokenHash: sha256Hex(token),
    });
    expect((row.expiresAt as Date).getTime() - before).toBeGreaterThanOrEqual(
      7 * 24 * 3600 * 1000,
    );
    expect(mailer.invite).toHaveBeenCalledWith(
      { email: 'guest@example.com', locale: 'en-US' },
      token,
    );
    expect(created).toEqual({
      invite: toInviteView(invite()),
      inviteUrl: `https://app/invite/${token}`,
      emailStatus: 'queued',
    });
  });

  it.each([
    ['disabled', 'disabled'],
    ['failed', 'disabled'],
    ['sent', 'sent'],
  ])('maps a %s send to emailStatus %s', async (result, status) => {
    const { service, mailer } = setup();
    mailer.invite.mockResolvedValue(result);

    const created = await service.create(
      'g@example.com',
      'parent',
      'a',
      'de-CH',
    );

    expect(created.emailStatus).toBe(status);
  });

  it('refuses an address that already has an account', async () => {
    const { service, users, invites } = setup();
    users.findByEmail.mockResolvedValue({ id: 'user-2' });

    const error = await errorOf(
      service.create('g@example.com', 'parent', 'a', 'de-CH'),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({ errorCode: 'EMAIL_TAKEN' });
    expect(invites.insert).not.toHaveBeenCalled();
  });
});

describe('InviteService list and revoke', () => {
  it('pages open invites', async () => {
    const { service, invites } = setup();

    await expect(service.list({ page: 2, pageSize: 5 })).resolves.toEqual({
      items: [toInviteView(invite())],
      total: 1,
      page: 2,
      pageSize: 5,
    });
    expect(invites.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        order: { createdAt: 'DESC' },
      }),
    );
  });

  it('reports whether an invite was revoked', async () => {
    const { service, invites } = setup();

    await expect(service.revoke('invite-1')).resolves.toBe(true);
    invites.delete.mockResolvedValue({ affected: 0 });
    await expect(service.revoke('invite-1')).resolves.toBe(false);
    invites.delete.mockResolvedValue({});
    await expect(service.revoke('invite-1')).resolves.toBe(false);
  });
});

describe('InviteService.details', () => {
  it('describes a valid invite', async () => {
    const { service, invites } = setup();

    await expect(service.details('tok')).resolves.toEqual({
      email: 'guest@example.com',
      role: 'parent',
      expiresAt: EXPIRES.toISOString(),
    });
    expect(invites.findOneBy).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: sha256Hex('tok') }),
    );
  });

  it.each(['', 'x'.repeat(129)])(
    '404s for a malformed token %j',
    async (token) => {
      const { service, invites } = setup();

      const error = await errorOf(service.details(token));

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVITE_INVALID',
      });
      expect(invites.findOneBy).not.toHaveBeenCalled();
    },
  );

  it('404s for an unknown, used or expired invite', async () => {
    const { service, invites } = setup();
    invites.findOneBy.mockResolvedValue(null);

    expect((await errorOf(service.details('tok'))).getStatus()).toBe(404);
  });
});

describe('InviteService.accept', () => {
  it('creates a verified user with the invited role', async () => {
    const { service, users, manager, passwords } = setup();

    await expect(
      service.accept('tok', 'long-password!', 'en-US'),
    ).resolves.toEqual({
      id: 'user-9',
    });
    expect(passwords.assertAcceptable).toHaveBeenCalledWith('long-password!');
    expect(manager.query.mock.calls[0][1]).toEqual([sha256Hex('tok')]);
    expect(users.create).toHaveBeenCalledWith(
      {
        email: 'guest@example.com',
        passwordHash: 'argon2id$hash',
        locale: 'en-US',
        role: 'admin',
        emailVerifiedAt: expect.any(Date),
      },
      manager,
    );
  });

  it('404s before hashing when the invite is invalid', async () => {
    const { service, invites, passwords } = setup();
    invites.findOneBy.mockResolvedValue(null);

    expect(
      (await errorOf(service.accept('tok', 'pw', 'de-CH'))).getStatus(),
    ).toBe(404);
    expect(passwords.hash).not.toHaveBeenCalled();
  });

  it('404s when a concurrent accept used the invite', async () => {
    const { service, manager, users } = setup();
    manager.query.mockResolvedValue([[], 0]);

    expect(
      (await errorOf(service.accept('tok', 'pw', 'de-CH'))).getStatus(),
    ).toBe(404);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('404s when the address registered meanwhile', async () => {
    const { service, users } = setup();
    users.create.mockRejectedValue({ code: '23505' });

    const error = await errorOf(service.accept('tok', 'pw', 'de-CH'));

    expect(error.getResponse()).toMatchObject({ errorCode: 'INVITE_INVALID' });
  });

  it('rethrows other errors', async () => {
    const { service, users } = setup();
    users.create.mockRejectedValue(new Error('db down'));

    await expect(service.accept('tok', 'pw', 'de-CH')).rejects.toThrow(
      'db down',
    );
  });
});
