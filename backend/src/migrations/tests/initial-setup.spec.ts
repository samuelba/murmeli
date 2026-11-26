import type { QueryRunner } from 'typeorm';
import { InitialSetup1795651200000 } from '../1795651200000-initial-setup';

function runner() {
  const query = jest.fn().mockResolvedValue(undefined);
  return { query, queryRunner: { query } as unknown as QueryRunner };
}

describe('InitialSetup1795651200000', () => {
  it('enables citext and creates app_settings', async () => {
    const { query, queryRunner } = runner();

    await new InitialSetup1795651200000().up(queryRunner);

    const sql = query.mock.calls.map(([statement]) => String(statement));
    expect(sql[0]).toContain('CREATE EXTENSION IF NOT EXISTS citext');
    expect(sql[1]).toContain('CREATE TABLE "app_settings"');
    expect(sql[1]).toContain(`CHECK ("source" IN ('env', 'admin'))`);
    expect(sql.join('\n')).not.toMatch(/pgcrypto|uuid_generate_v7/);
  });

  it('seeds registration_enabled with a fixed false, independent of env', async () => {
    const original = process.env.REGISTRATION_ENABLED;
    process.env.REGISTRATION_ENABLED = 'true';
    const { query, queryRunner } = runner();

    try {
      await new InitialSetup1795651200000().up(queryRunner);
    } finally {
      if (original === undefined) {
        delete process.env.REGISTRATION_ENABLED;
      } else {
        process.env.REGISTRATION_ENABLED = original;
      }
    }

    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining(`VALUES ($1, 'false'::jsonb, 'env')`),
      ['registration_enabled'],
    );
  });

  it('drops what it created', async () => {
    const { query, queryRunner } = runner();

    await new InitialSetup1795651200000().down(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('DROP TABLE "app_settings"');
  });
});
