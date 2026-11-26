import {
  APP_ROLE_SETTING,
  NARROWED_TABLES,
  assertNarrowedGrants,
  narrowGrantsSql,
} from './narrowed-grants';

describe('narrowGrantsSql', () => {
  it('narrows every listed table in one idempotent DO block', () => {
    const sql = narrowGrantsSql();

    expect(sql.match(/DO \$\$/g)).toHaveLength(1);
    for (const { table } of NARROWED_TABLES) {
      expect(sql).toContain(`to_regclass('public."${table}"')`);
      expect(sql).toContain(`REVOKE UPDATE ON "${table}" FROM %I`);
    }
    expect(sql).toContain(
      `GRANT UPDATE ("actor_id", "ip", "target_id") ON "audit_log" TO %I`,
    );
    expect(sql).not.toContain('ON "attempts" TO');
    expect(sql).toContain(`current_setting('${APP_ROLE_SETTING}', true)`);
    expect(sql.match(/grantee <> current_user/g)).toHaveLength(2);
    expect(sql.match(/rolname <> current_user/g)).toHaveLength(2);
  });

  it('can limit the block to some tables, as a migration does', () => {
    const sql = narrowGrantsSql(['attempts']);

    expect(sql).toContain('REVOKE UPDATE ON "attempts"');
    expect(sql).not.toContain('audit_log');
  });
});

describe('assertNarrowedGrants', () => {
  it('names the runtime role for the block, then runs it', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    await assertNarrowedGrants(manager, 'murmeli_app');

    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      'SELECT set_config($1, $2, true)',
      [APP_ROLE_SETTING, 'murmeli_app'],
    );
    expect(manager.query).toHaveBeenNthCalledWith(2, narrowGrantsSql());
  });

  it('only narrows existing grantees without a runtime role', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    await assertNarrowedGrants(manager, null);

    expect(manager.query.mock.calls[0][1]).toEqual([APP_ROLE_SETTING, '']);
  });
});
