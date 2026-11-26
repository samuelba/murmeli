import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { errorMessage } from '../../common/errors/error-message';
import { AUDIT_RETENTION_DAYS } from './audit.types';

export const RETENTION_BATCH_SIZE = 10_000;

export interface RetentionRule {
  readonly name: string;
  readonly table: string;
  readonly condition: string;
}

/** One rule per indexable condition, so no OR defeats the indexes */
export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    name: 'audit_log',
    table: 'audit_log',
    condition: `"at" < now() - make_interval(days => ${AUDIT_RETENTION_DAYS})`,
  },
  {
    name: 'refresh_tokens',
    table: 'refresh_tokens',
    condition: `"expires_at" < now()`,
  },
  {
    name: 'email_tokens_expired',
    table: 'email_tokens',
    condition: `"expires_at" < now()`,
  },
  {
    name: 'email_tokens_used',
    table: 'email_tokens',
    condition: `"used_at" IS NOT NULL`,
  },
  {
    name: 'invites_expired',
    table: 'invites',
    condition: `"expires_at" < now()`,
  },
  {
    name: 'invites_accepted',
    table: 'invites',
    condition: `"accepted_at" IS NOT NULL`,
  },
];

export function batchDeleteSql(rule: RetentionRule): string {
  return `WITH "doomed" AS (
    SELECT "id" FROM "${rule.table}" WHERE ${rule.condition} LIMIT ${RETENTION_BATCH_SIZE}
  )
  DELETE FROM "${rule.table}" WHERE "id" IN (SELECT "id" FROM "doomed")`;
}

/**
 * Daily cleanup: audit entries older than the retention period, and expired
 * or used tokens and invites. Deletes run in batches, so a large backlog
 * never holds long locks.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'retention' })
  async purge(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    for (const rule of RETENTION_RULES) {
      try {
        results[rule.name] = await this.purgeRule(rule);
      } catch (error) {
        this.logger.error(
          `Cleanup of ${rule.name} failed: ${errorMessage(error)}`,
        );
      }
    }
    this.logger.log(`Retention cleanup: ${JSON.stringify(results)}`);
    return results;
  }

  private async purgeRule(rule: RetentionRule): Promise<number> {
    const sql = batchDeleteSql(rule);
    let total = 0;
    for (;;) {
      const [, affected] =
        await this.dataSource.query<[unknown, number | undefined]>(sql);
      total += affected ?? 0;
      if ((affected ?? 0) < RETENTION_BATCH_SIZE) {
        return total;
      }
    }
  }
}
