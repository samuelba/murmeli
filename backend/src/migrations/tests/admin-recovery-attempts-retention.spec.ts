import type { QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/audit/audit.types';
import { sqlList } from '../../modules/users/user.types';
import { AdminRecoveryAttemptsRetention1795720261819 } from '../1795720261819-admin-recovery-attempts-retention';

async function run(direction: 'up' | 'down'): Promise<string[]> {
  const query = jest.fn().mockResolvedValue(undefined);
  await new AdminRecoveryAttemptsRetention1795720261819()[direction]({
    query,
  } as unknown as QueryRunner);
  return query.mock.calls.map(([statement]) => String(statement));
}

describe('AdminRecoveryAttemptsRetention1795720261819', () => {
  it('allows exactly the current audit actions and indexes attempts by time', async () => {
    const sql = await run('up');

    expect(sql[1]).toContain(`CHECK ("action" IN (${sqlList(AUDIT_ACTIONS)}))`);
    expect(sql[2]).toBe(
      `CREATE INDEX "IDX_attempts_created_at" ON "attempts" ("created_at")`,
    );
  });

  it('restores the previous check without dropping newer entries', async () => {
    const sql = await run('down');

    expect(sql[0]).toContain('DROP INDEX "public"."IDX_attempts_created_at"');
    expect(sql[2]).not.toContain('admin.email_verified');
    expect(sql[2]).toContain("'kid.pin_locked'");
    expect(sql[2]).toMatch(/NOT VALID$/);
  });
});
