import type { QueryRunner } from 'typeorm';
import {
  ATTEMPTS_GRANTS_SQL,
  LearningEngine1795716581681,
} from '../1795716581681-learning-engine';

async function run(direction: 'up' | 'down'): Promise<string[]> {
  const query = jest.fn().mockResolvedValue(undefined);
  await new LearningEngine1795716581681()[direction]({
    query,
  } as unknown as QueryRunner);
  return query.mock.calls.map(([statement]) => String(statement));
}

const TABLES = [
  'level_progress',
  'skill_mastery',
  'attempts',
  'daily_activity',
  'kid_badges',
];

describe('LearningEngine1795716581681', () => {
  it('creates the progress tables with cascading kid foreign keys', async () => {
    const sql = await run('up');
    for (const table of TABLES) {
      expect(sql).toContainEqual(
        expect.stringContaining(`CREATE TABLE "${table}"`),
      );
      expect(sql).toContainEqual(
        expect.stringContaining(
          `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_kid_id" FOREIGN KEY ("kid_id") REFERENCES "kids"("id") ON DELETE CASCADE`,
        ),
      );
    }
  });

  it('adds the checks and the indexes for map, practice and history queries', async () => {
    const all = (await run('up')).join('\n');
    expect(all).toContain('PRIMARY KEY ("kid_id", "level_id")');
    expect(all).toContain('PRIMARY KEY ("kid_id", "skill_id")');
    expect(all).toContain('PRIMARY KEY ("kid_id", "day")');
    expect(all).toContain('PRIMARY KEY ("kid_id", "badge_id")');
    expect(all).toContain(
      `CREATE INDEX "IDX_attempts_kid_created_at" ON "attempts" ("kid_id", "created_at")`,
    );
    expect(all).toContain(
      `CREATE UNIQUE INDEX "UQ_attempts_run_item_attempt" ON "attempts" ("run_id", "item_index", "attempt")`,
    );
    expect(all).toContain(
      `CREATE INDEX "IDX_skill_mastery_kid_next_review" ON "skill_mastery" ("kid_id", "next_review_at")`,
    );
    expect(all).toContain(`CHECK ("stars" BETWEEN 0 AND 3)`);
    expect(all).toContain(`CHECK ("box" BETWEEN 1 AND 5)`);
    expect(all).toContain(
      `CHECK (("mode" = 'practice') = ("level_id" IS NULL))`,
    );
    expect(all).toContain('DEFAULT uuidv7()');
  });

  it('makes attempts append-only for the runtime role, last', async () => {
    const sql = await run('up');
    expect(sql[sql.length - 1]).toBe(ATTEMPTS_GRANTS_SQL);
    expect(ATTEMPTS_GRANTS_SQL).toContain('REVOKE UPDATE ON "attempts"');
    expect(sql.join('\n')).not.toMatch(/\breal\b/);
    expect(sql.join('\n')).toContain('CHECK ("seconds" BETWEEN 0 AND 86400)');
  });

  it('removes everything it created on the way down', async () => {
    const sql = (await run('down')).join('\n');
    for (const table of TABLES) {
      expect(sql).toContain(`"${table}"`);
    }
    expect(sql).toContain('"IDX_attempts_kid_created_at"');
  });
});
