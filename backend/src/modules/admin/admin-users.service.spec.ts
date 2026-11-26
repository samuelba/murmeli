import { HttpException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AuditService } from '../audit/audit.service';
import type { SessionService } from '../auth/sessions/session.service';
import { deleteUserIn } from '../users/user-deletion';
import { ADMIN_LOCK_ID, UserGuardrail } from '../users/user-guardrail.service';
import type { UserEntity } from '../users/user.entity';
import {
  AdminUsersService,
  escapeLike,
  sessionEndReason,
} from './admin-users.service';

jest.mock('../users/user-deletion', () => ({
  deleteUserIn: jest.fn().mockResolvedValue(undefined),
}));

const ADMIN_ID = '01a218d7-5edc-7a87-a1d4-5fe46ddc652d';
const USER_ID = '01a218d7-5edc-7a87-a1d4-5fe46ddc6530';
const actor = { userId: ADMIN_ID, ip: '203.0.113.1' };

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: USER_ID,
    email: 'anna@example.com',
    passwordHash: 'argon2id$x',
    role: 'parent',
    locale: 'de-CH',
    theme: null,
    emailVerifiedAt: null,
    totpEnabled: false,
    disabled: false,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(target: UserEntity | null = user(), otherAdmins = 1) {
  const builder = {
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawAndEntities: jest.fn().mockResolvedValue({
      entities: [user(), user({ id: ADMIN_ID, role: 'admin' })],
      raw: [{ kid_count: '2' }],
    }),
    getCount: jest.fn().mockResolvedValue(2),
  };
  let current = target;
  const manager = {
    query: jest.fn((sql: string) =>
      Promise.resolve(sql.includes('COUNT') ? [{ count: otherAdmins }] : []),
    ),
    findOneBy: jest.fn(() => Promise.resolve(current)),
    findOneByOrFail: jest.fn(() => Promise.resolve(current)),
    update: jest.fn(
      (_entity: unknown, _where: unknown, changes: Partial<UserEntity>) => {
        current = current && { ...current, ...changes };
        return Promise.resolve({});
      },
    ),
  };
  const dataSource = {
    getRepository: () => ({ createQueryBuilder: () => builder }),
    transaction: jest.fn((work: (m: typeof manager) => unknown) =>
      work(manager),
    ),
    query: jest.fn().mockResolvedValue([{ count: 3 }]),
  };
  const sessions = {
    revokeUserSessionsIn: jest.fn().mockResolvedValue(['fam1']),
    markRevoked: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminUsersService(
    dataSource as unknown as DataSource,
    sessions as unknown as SessionService,
    audit as unknown as AuditService,
    new UserGuardrail(dataSource as unknown as DataSource),
  );
  return { service, builder, manager, sessions, audit };
}

async function failure(promise: Promise<unknown>) {
  const error = (await promise.catch((e: unknown) => e)) as HttpException;
  expect(error).toBeInstanceOf(HttpException);
  return [
    error.getStatus(),
    (error.getResponse() as { errorCode: string }).errorCode,
  ];
}

describe('escapeLike', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeLike('50%_off\\x')).toBe('50\\%\\_off\\\\x');
  });
});

describe('AdminUsersService.list', () => {
  it('pages users with kid counts', async () => {
    const { service, builder } = setup();

    const page = await service.list({ page: 2, pageSize: 10 });

    expect(builder.offset).toHaveBeenCalledWith(10);
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(builder.where).not.toHaveBeenCalled();
    expect(page.total).toBe(2);
    expect(page.items[0]).toMatchObject({
      id: USER_ID,
      kidCount: 2,
      disabled: false,
      lastLoginAt: null,
    });
    expect(page.items[1].kidCount).toBe(0);
    expect(JSON.stringify(page)).not.toContain('argon2id');
  });

  it('searches emails with escaped wildcards', async () => {
    const { service, builder } = setup();

    await service.list({ search: 'a_b%' });

    expect(builder.where).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE :search'),
      { search: '%a\\_b\\%%' },
    );
  });
});

describe('sessionEndReason', () => {
  it.each([
    [user(), { disabled: true }, 'disabled'],
    [user({ disabled: true }), { disabled: true }, null],
    [user(), { role: 'admin' as const }, 'role_changed'],
    [user(), { role: 'parent' as const }, null],
    [user(), { disabled: false }, null],
  ])('%#: %j', (current, dto, expected) => {
    expect(sessionEndReason(current, dto)).toBe(expected);
  });
});

describe('AdminUsersService.update', () => {
  it('changes the role under the admin lock, ends the sessions and audits', async () => {
    const { service, manager, sessions, audit } = setup();

    const view = await service.update(actor, USER_ID, { role: 'admin' });

    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock($1)',
      [ADMIN_LOCK_ID],
    );
    expect(view).toMatchObject({ id: USER_ID, role: 'admin', kidCount: 3 });
    expect(sessions.revokeUserSessionsIn).toHaveBeenCalledWith(
      manager,
      USER_ID,
      'role_changed',
    );
    expect(sessions.markRevoked).toHaveBeenCalledWith(['fam1']);
    expect(audit.record).toHaveBeenCalledWith({
      action: 'admin.user_updated',
      actorId: ADMIN_ID,
      targetType: 'user',
      targetId: USER_ID,
      ip: '203.0.113.1',
      meta: { role: 'admin' },
    });
  });

  it('revokes all sessions when disabling', async () => {
    const { service, sessions, audit } = setup();

    const view = await service.update(actor, USER_ID, { disabled: true });

    expect(view.disabled).toBe(true);
    expect(sessions.revokeUserSessionsIn).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      'disabled',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { disabled: true } }),
    );
  });

  it.each([{ role: 'parent' as const }, { disabled: true }])(
    'keeps the last active admin (%j) with 400 LAST_ADMIN',
    async (dto) => {
      const { service, manager, sessions } = setup(user({ role: 'admin' }), 0);

      await expect(
        failure(service.update(actor, USER_ID, dto)),
      ).resolves.toEqual([400, 'LAST_ADMIN']);
      expect(manager.update).not.toHaveBeenCalled();
      expect(sessions.markRevoked).not.toHaveBeenCalled();
    },
  );

  it('allows demoting an admin while another remains', async () => {
    const { service } = setup(user({ role: 'admin' }), 1);

    await expect(
      service.update(actor, USER_ID, { role: 'parent' }),
    ).resolves.toMatchObject({ role: 'parent' });
  });

  it('skips the write and keeps sessions for an empty patch', async () => {
    const { service, manager, sessions } = setup();

    await service.update(actor, USER_ID, {});

    expect(manager.update).not.toHaveBeenCalled();
    expect(sessions.revokeUserSessionsIn).not.toHaveBeenCalled();
    expect(sessions.markRevoked).toHaveBeenCalledWith([]);
  });

  it.each([USER_ID, 'not-a-uuid'])(
    'answers 404 USER_NOT_FOUND for %s',
    async (id) => {
      const { service } = setup(null);

      await expect(
        failure(service.update(actor, id, { role: 'admin' })),
      ).resolves.toEqual([404, 'USER_NOT_FOUND']);
    },
  );
});

describe('AdminUsersService.delete', () => {
  beforeEach(() => (deleteUserIn as jest.Mock).mockClear());

  it('refuses to delete oneself', async () => {
    const { service } = setup(user({ id: ADMIN_ID, role: 'admin' }));

    await expect(failure(service.delete(actor, ADMIN_ID))).resolves.toEqual([
      400,
      'CANNOT_DELETE_SELF',
    ]);
    expect(deleteUserIn).not.toHaveBeenCalled();
  });

  it('revokes, deletes and audits without the deleted id', async () => {
    const { service, manager, sessions, audit } = setup();

    await service.delete(actor, USER_ID);

    expect(sessions.revokeUserSessionsIn).toHaveBeenCalledWith(
      manager,
      USER_ID,
      'deleted',
    );
    expect(deleteUserIn).toHaveBeenCalledWith(manager, USER_ID);
    expect(sessions.markRevoked).toHaveBeenCalledWith(['fam1']);
    expect(audit.record).toHaveBeenCalledWith({
      action: 'admin.user_deleted',
      actorId: ADMIN_ID,
      targetType: 'user',
      ip: '203.0.113.1',
    });
  });

  it('keeps the last active admin', async () => {
    const { service } = setup(user({ role: 'admin' }), 0);

    await expect(failure(service.delete(actor, USER_ID))).resolves.toEqual([
      400,
      'LAST_ADMIN',
    ]);
    expect(deleteUserIn).not.toHaveBeenCalled();
  });

  it('may delete a disabled admin', async () => {
    const { service } = setup(user({ role: 'admin', disabled: true }), 0);

    await service.delete(actor, USER_ID);

    expect(deleteUserIn).toHaveBeenCalled();
  });

  it('answers 404 for unknown users', async () => {
    const { service } = setup(null);

    await expect(failure(service.delete(actor, USER_ID))).resolves.toEqual([
      404,
      'USER_NOT_FOUND',
    ]);
  });
});

describe('AdminUsersService.recordInvite', () => {
  it('audits invite actions with optional meta', async () => {
    const { service, audit } = setup();

    await service.recordInvite('admin.invite_created', actor, 'i1', {
      role: 'parent',
    });
    await service.recordInvite('admin.invite_revoked', actor, 'i1');

    expect(audit.record).toHaveBeenNthCalledWith(1, {
      action: 'admin.invite_created',
      actorId: ADMIN_ID,
      targetType: 'invite',
      targetId: 'i1',
      ip: '203.0.113.1',
      meta: { role: 'parent' },
    });
    expect(audit.record.mock.calls[1][0]).not.toHaveProperty('meta');
  });
});
