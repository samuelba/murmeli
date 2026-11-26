import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  RETENTION_BATCH_SIZE,
  RETENTION_RULES,
  RetentionService,
  batchDeleteSql,
} from './retention.service';

describe('RetentionService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps audit entries for 180 days and splits OR conditions into rules', () => {
    expect(RETENTION_RULES.map((rule) => rule.name)).toEqual([
      'audit_log',
      'refresh_tokens',
      'email_tokens_expired',
      'email_tokens_used',
      'invites_expired',
      'invites_accepted',
    ]);
    expect(RETENTION_RULES[0].condition).toContain(
      'make_interval(days => 180)',
    );
    for (const rule of RETENTION_RULES) {
      expect(rule.condition).not.toMatch(/\bOR\b/);
    }
  });

  it('deletes in batches through a CTE with a limit', () => {
    const sql = batchDeleteSql(RETENTION_RULES[1]);

    expect(sql).toContain('WITH "doomed" AS');
    expect(sql).toContain(`LIMIT ${RETENTION_BATCH_SIZE}`);
    expect(sql).toContain(
      'DELETE FROM "refresh_tokens" WHERE "id" IN (SELECT "id" FROM "doomed")',
    );
  });

  it('repeats a rule while full batches come back and sums the rows', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([[], RETENTION_BATCH_SIZE])
      .mockResolvedValueOnce([[], RETENTION_BATCH_SIZE])
      .mockResolvedValueOnce([[], 3])
      .mockResolvedValueOnce([[], undefined])
      .mockResolvedValue([[], 1]);
    const service = new RetentionService({ query } as unknown as DataSource);

    await expect(service.purge()).resolves.toEqual({
      audit_log: 2 * RETENTION_BATCH_SIZE + 3,
      refresh_tokens: 0,
      email_tokens_expired: 1,
      email_tokens_used: 1,
      invites_expired: 1,
      invites_accepted: 1,
    });
    expect(query).toHaveBeenCalledTimes(8);
  });

  it('continues after a failed rule', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(new Error('locked'))
      .mockResolvedValue([[], 2]);
    const service = new RetentionService({ query } as unknown as DataSource);

    const result = await service.purge();

    expect(result).not.toHaveProperty('audit_log');
    expect(result.invites_accepted).toBe(2);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('audit_log failed: locked'),
    );
  });
});
