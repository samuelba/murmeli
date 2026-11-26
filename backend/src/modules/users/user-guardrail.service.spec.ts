import { HttpException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import type { UserEntity } from './user.entity';
import {
  ADMIN_LOCK_ID,
  UserGuardrail,
  lastAdmin,
  userNotFound,
} from './user-guardrail.service';

const ID = '01a218d7-5edc-7a87-a1d4-5fe46ddc652d';

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: ID,
    role: 'admin',
    disabled: false,
    ...overrides,
  } as UserEntity;
}

function setup(found: UserEntity | null, otherAdmins = 0) {
  const manager = {
    query: jest.fn((sql: string) =>
      Promise.resolve(sql.includes('COUNT') ? [{ count: otherAdmins }] : []),
    ),
    findOneBy: jest.fn().mockResolvedValue(found),
  };
  const dataSource = {
    transaction: jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  return {
    manager,
    dataSource,
    guardrail: new UserGuardrail(dataSource as unknown as DataSource),
  };
}

function codeOf(error: unknown): unknown {
  return ((error as HttpException).getResponse() as { errorCode: string })
    .errorCode;
}

describe('UserGuardrail', () => {
  it('runs the mutation under the admin advisory lock and returns its result', async () => {
    const { guardrail, manager } = setup(user({ role: 'parent' }));
    const mutation = jest.fn().mockResolvedValue('done');

    await expect(guardrail.mutate(ID, () => true, mutation)).resolves.toBe(
      'done',
    );

    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock($1)',
      [ADMIN_LOCK_ID],
    );
    expect(mutation).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: ID }),
    );
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it.each([['not-a-uuid'], ['01a218d7-5edc-7a87-a1d4-5fe46ddc6530']])(
    'answers 404 USER_NOT_FOUND for %s',
    async (id) => {
      const { guardrail } = setup(null);
      const mutation = jest.fn();

      await expect(
        guardrail.mutate(id, () => true, mutation).catch(codeOf),
      ).resolves.toBe('USER_NOT_FOUND');
      expect(mutation).not.toHaveBeenCalled();
    },
  );

  it('refuses to remove the last active admin', async () => {
    const { guardrail } = setup(user(), 0);
    const mutation = jest.fn();

    await expect(
      guardrail.mutate(ID, () => true, mutation).catch(codeOf),
    ).resolves.toBe('LAST_ADMIN');
    expect(mutation).not.toHaveBeenCalled();
  });

  it('lets an admin go when another active admin remains', async () => {
    const { guardrail, manager } = setup(user(), 1);
    const mutation = jest.fn().mockResolvedValue(undefined);

    await guardrail.mutate(ID, () => true, mutation);

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('"id" <> $1'),
      [ID],
    );
    expect(mutation).toHaveBeenCalled();
  });

  it('skips the admin count when the change keeps the admin role', async () => {
    const { guardrail, manager } = setup(user(), 0);
    const losesAdmin = jest.fn().mockReturnValue(false);

    await guardrail.mutate(ID, losesAdmin, jest.fn());

    expect(losesAdmin).toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a parent', { role: 'parent' as const }],
    ['a disabled admin', { disabled: true }],
  ])('does not count admins for %s', async (_label, overrides) => {
    const { guardrail, manager } = setup(user(overrides), 0);
    const losesAdmin = jest.fn().mockReturnValue(true);

    await guardrail.mutate(ID, losesAdmin, jest.fn());

    expect(losesAdmin).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it('builds the error responses', () => {
    expect(lastAdmin().getStatus()).toBe(400);
    expect(userNotFound().getStatus()).toBe(404);
  });
});
