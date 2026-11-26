import type { QueryRunner } from 'typeorm';
import {
  AUDIT_LOG_GRANTS_SQL,
  Accounts1795712133442,
} from '../1795712133442-accounts';

function runner() {
  const query = jest.fn().mockResolvedValue(undefined);
  return { query, queryRunner: { query } as unknown as QueryRunner };
}

const TABLES = [
  'audit_log',
  'users',
  'recovery_codes',
  'invites',
  'email_tokens',
  'refresh_tokens',
  'totp_secrets',
  'kids',
];

const MANUAL_INDEXES = [
  'IDX_refresh_tokens_active_family',
  'IDX_audit_log_at_id',
  'IDX_audit_log_action_at_id',
];

function statements(query: jest.Mock): string[] {
  return query.mock.calls.map(([statement]) => String(statement));
}

async function up(): Promise<string[]> {
  const { query, queryRunner } = runner();
  await new Accounts1795712133442().up(queryRunner);
  return statements(query);
}

describe('Accounts1795712133442', () => {
  it('creates the account tables with cascading foreign keys and uuidv7 keys', async () => {
    const sql = await up();

    for (const table of TABLES) {
      expect(sql).toContainEqual(
        expect.stringContaining(`CREATE TABLE "${table}"`),
      );
    }
    expect(
      sql.filter((statement) => statement.includes('ON DELETE CASCADE')),
    ).toHaveLength(5);
    const all = sql.join('\n');
    expect(all).toContain('"email" citext NOT NULL');
    expect(all).toContain('DEFAULT uuidv7()');
    expect(all).not.toContain('uuid_generate_v7');
  });

  it('creates the partial, covering and descending indexes', async () => {
    const all = (await up()).join('\n');

    expect(all).toContain(
      `CREATE UNIQUE INDEX "UQ_email_tokens_open" ON "email_tokens" ("user_id", "type") WHERE "used_at" IS NULL`,
    );
    expect(all).toContain(
      `CREATE UNIQUE INDEX "UQ_invites_pending_email" ON "invites" ("email") WHERE "accepted_at" IS NULL`,
    );
    expect(all).toContain(`WHERE "role" = 'admin' AND "disabled" = false`);
    expect(all).toContain(
      `ON "refresh_tokens" ("family_id") INCLUDE ("expires_at") WHERE "revoked" = false`,
    );
    expect(all).toContain(`ON "audit_log" ("at" DESC, "id" DESC)`);
    expect(all).toContain(`ON "audit_log" ("action", "at" DESC, "id" DESC)`);
    expect(all).toContain(`CREATE INDEX "IDX_audit_log_actor_id"`);
    expect(all).toContain(`CHECK (btrim("nickname") <> '')`);
    expect(all).toContain(`CHECK (char_length("user_agent") <= 200)`);
  });

  it('seeds require_admin_totp and narrows the audit_log grants last', async () => {
    const sql = await up();

    expect(sql[sql.length - 2]).toContain(
      `VALUES ('require_admin_totp', 'false'::jsonb, 'env')`,
    );
    expect(sql[sql.length - 1]).toBe(AUDIT_LOG_GRANTS_SQL);
    expect(AUDIT_LOG_GRANTS_SQL).toContain('REVOKE UPDATE ON "audit_log"');
    expect(AUDIT_LOG_GRANTS_SQL).toContain(
      'GRANT UPDATE ("actor_id", "ip", "target_id") ON "audit_log"',
    );
    expect(AUDIT_LOG_GRANTS_SQL).toContain('grantee <> current_user');
  });

  it('removes the setting, the manual indexes and every table', async () => {
    const { query, queryRunner } = runner();

    await new Accounts1795712133442().down(queryRunner);

    const sql = statements(query);
    expect(sql[0]).toContain('require_admin_totp');
    for (const index of MANUAL_INDEXES) {
      expect(sql).toContainEqual(
        expect.stringContaining(`DROP INDEX "public"."${index}"`),
      );
    }
    for (const table of TABLES) {
      expect(sql).toContainEqual(expect.stringContaining(`TABLE "${table}"`));
    }
  });
});
