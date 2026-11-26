import { sha256Hex } from '../../../common/crypto/secure-token';
import { EMAIL_TOKEN_TTL_SECONDS } from '../auth.constants';
import { EmailTokenEntity } from '../entities/email-token.entity';
import { EmailTokenService } from './email-token.service';

function setup() {
  const manager = { query: jest.fn(), insert: jest.fn() };
  const dataSource = {
    query: jest.fn(),
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  const service = new EmailTokenService(dataSource as never);
  return { service, manager, dataSource };
}

describe('EmailTokenService', () => {
  it.each(Object.entries(EMAIL_TOKEN_TTL_SECONDS))(
    'issues a %s token that expires after %i s and stores only its hash',
    async (type, ttl) => {
      const { service, manager } = setup();
      const before = Date.now();

      const token = await service.issue('user-1', type as never);

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const [entity, row] = manager.insert.mock.calls[0] as [
        unknown,
        { expiresAt: Date },
      ];
      expect(entity).toBe(EmailTokenEntity);
      expect(row).toMatchObject({
        userId: 'user-1',
        type,
        tokenHash: sha256Hex(token),
        newEmail: null,
      });
      const expires = row.expiresAt.getTime();
      expect(expires).toBeGreaterThanOrEqual(before + ttl * 1000);
      expect(expires).toBeLessThanOrEqual(Date.now() + ttl * 1000);
    },
  );

  it('locks the user, invalidates the open token of the type, then inserts', async () => {
    const { service, manager } = setup();

    await service.issue('user-1', 'email_change', 'next@example.com');

    const [lock, invalidate] = manager.query.mock.calls as [
      [string, unknown[]],
      [string, unknown[]],
    ];
    expect(lock[0]).toContain('FOR UPDATE');
    expect(lock[1]).toEqual(['user-1']);
    expect(invalidate[0]).toContain('UPDATE "email_tokens"');
    expect(invalidate[1]).toEqual(['user-1', 'email_change']);
    expect(manager.insert.mock.calls[0][1]).toMatchObject({
      newEmail: 'next@example.com',
    });
  });

  it('returns the expiry with the token', async () => {
    const { service, manager } = setup();

    const issued = await service.issueWithExpiry('user-1', 'password_reset');

    const row = manager.insert.mock.calls[0][1] as {
      tokenHash: string;
      expiresAt: Date;
    };
    expect(row.tokenHash).toBe(sha256Hex(issued.token));
    expect(issued.expiresAt).toBe(row.expiresAt);
  });

  it('invalidates the open tokens of one type', async () => {
    const { service, dataSource, manager } = setup();

    await service.invalidate('user-1', 'registration');
    await service.invalidate('user-2', 'password_reset', manager);

    expect(dataSource.query.mock.calls[0][1]).toEqual([
      'user-1',
      'registration',
    ]);
    expect(manager.query.mock.calls[0][1]).toEqual([
      'user-2',
      'password_reset',
    ]);
  });

  it('invalidates every open token of a user', async () => {
    const { service, dataSource, manager } = setup();

    await service.invalidateAll('user-1');
    await service.invalidateAll('user-2', manager);

    expect(dataSource.query.mock.calls[0][1]).toEqual(['user-1', null]);
    expect(manager.query.mock.calls[0][1]).toEqual(['user-2', null]);
  });

  it('consumes a valid token atomically', async () => {
    const { service, dataSource } = setup();
    dataSource.query.mockResolvedValue([
      [{ user_id: 'user-1', type: 'registration', new_email: null }],
      1,
    ]);

    await expect(service.consume('tok', ['registration'])).resolves.toEqual({
      userId: 'user-1',
      type: 'registration',
      newEmail: null,
    });
    const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown];
    expect(sql).toContain('"used_at" IS NULL AND "expires_at" > now()');
    expect(params).toEqual([sha256Hex('tok'), ['registration']]);
  });

  it('consumes inside the given transaction', async () => {
    const { service, dataSource, manager } = setup();
    manager.query.mockResolvedValue([
      [{ user_id: 'u', type: 'email_change', new_email: 'n@example.com' }],
      1,
    ]);

    await expect(
      service.consume('tok', ['email_change'], manager),
    ).resolves.toEqual({
      userId: 'u',
      type: 'email_change',
      newEmail: 'n@example.com',
    });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('returns null for an unknown, used or expired token', async () => {
    const { service, dataSource } = setup();
    dataSource.query.mockResolvedValue([[], 0]);

    await expect(
      service.consume('tok', ['password_reset']),
    ).resolves.toBeNull();
  });

  it.each(['', 'x'.repeat(129)])('skips the database for %j', async (token) => {
    const { service, dataSource } = setup();

    await expect(service.consume(token, ['registration'])).resolves.toBeNull();
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
