import type { EntityManager } from 'typeorm';
import { ANONYMIZE_AUDIT_SQL, deleteUserIn } from './user-deletion';

describe('deleteUserIn', () => {
  it('anonymizes the audit log before deleting the user', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    await deleteUserIn(manager as unknown as EntityManager, 'u1');

    const sql = manager.query.mock.calls.map(([statement]) =>
      String(statement),
    );
    expect(sql).toEqual([
      ...ANONYMIZE_AUDIT_SQL,
      'DELETE FROM "users" WHERE "id" = $1',
    ]);
    for (const [, params] of manager.query.mock.calls) {
      expect(params).toEqual(['u1']);
    }
  });

  it('clears actor, IP and user or kid targets', () => {
    const all = ANONYMIZE_AUDIT_SQL.join('\n');
    expect(all).toContain('"actor_id" = NULL, "ip" = NULL');
    expect(all).toContain(`"target_type" = 'user'`);
    expect(all).toContain(`"target_type" = 'kid'`);
    expect(all).toContain('FROM "kids" WHERE "user_id" = $1');
  });
});
