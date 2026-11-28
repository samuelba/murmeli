import type { QueryRunner } from 'typeorm';
import { PracticeGround1795867200000 } from '../1795867200000-practice-ground';

async function run(direction: 'up' | 'down'): Promise<string[]> {
  const query = jest.fn().mockResolvedValue(undefined);
  await new PracticeGround1795867200000()[direction]({
    query,
  } as unknown as QueryRunner);
  return query.mock.calls.map(([statement]) => String(statement));
}

const TABLES = [
  'practice_topic_progress',
  'practice_daily',
  'practice_reviews',
];

describe('PracticeGround1795867200000', () => {
  it('creates the practice tables with cascading kid foreign keys', async () => {
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

  it('adds the keys, checks and indexes the queries rely on', async () => {
    const all = (await run('up')).join('\n');
    expect(all).toContain('PRIMARY KEY ("kid_id", "topic_id")');
    expect(all).toContain('PRIMARY KEY ("kid_id", "topic_id", "day")');
    expect(all).toContain(
      'CREATE UNIQUE INDEX "UQ_practice_reviews_kid_item_key" ON "practice_reviews" ("kid_id", "item_key")',
    );
    expect(all).toContain(
      '"IDX_practice_reviews_kid_topic_due" ON "practice_reviews" ("kid_id", "topic_id", "due_at")',
    );
    expect(all).toContain('"seed" BETWEEN 0 AND 4294967295');
    expect(all).toContain('"box" BETWEEN 0 AND 2');
    expect(all).toContain('"first_try" BETWEEN 0 AND "items"');
  });

  it('drops everything again in reverse order', async () => {
    const sql = await run('down');
    expect(sql[0]).toContain('DROP CONSTRAINT "FK_practice_reviews_kid_id"');
    expect(sql.filter((s) => s.startsWith('DROP TABLE'))).toEqual([
      'DROP TABLE "practice_reviews"',
      'DROP TABLE "practice_daily"',
      'DROP TABLE "practice_topic_progress"',
    ]);
  });
});
