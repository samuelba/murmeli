import type { DataSource } from 'typeorm';
import { ProgressStore } from './progress.store';

function setup(rows: unknown[] = []) {
  const query = jest.fn().mockResolvedValue(rows);
  const dataSource = {
    query,
    transaction: jest.fn((work: (db: unknown) => unknown) => work({ query })),
  };
  return {
    query,
    dataSource,
    store: new ProgressStore(dataSource as unknown as DataSource),
  };
}

const sqlOf = (query: jest.Mock) => String(query.mock.calls[0][0]);
const paramsOf = (query: jest.Mock) => query.mock.calls[0][1] as unknown[];

describe('ProgressStore', () => {
  it('maps level progress rows', async () => {
    const passedAt = new Date('2026-01-01T00:00:00Z');
    const { store, query } = setup([
      {
        level_id: 'l1',
        stars: 3,
        best_score: '1',
        runs: 2,
        first_passed_at: passedAt,
        demo_seen_at: passedAt,
      },
      {
        level_id: 'l2',
        stars: 9,
        best_score: 0.25,
        runs: 1,
        first_passed_at: null,
        demo_seen_at: null,
      },
    ]);
    await expect(store.levels('k1')).resolves.toEqual([
      {
        levelId: 'l1',
        stars: 3,
        passed: true,
        bestScore: 1,
        runs: 2,
        firstPassedAt: passedAt,
        demoSeen: true,
      },
      {
        levelId: 'l2',
        stars: 3,
        passed: false,
        bestScore: 0.25,
        runs: 1,
        firstPassedAt: null,
        demoSeen: false,
      },
    ]);
    expect(paramsOf(query)).toEqual(['k1']);
  });

  it('maps mastery rows', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const { store } = setup([
      {
        skill_id: 's',
        mastery: '0.5',
        box: 2,
        next_review_at: at,
        updated_at: at,
      },
    ]);
    await expect(store.mastery('k1')).resolves.toEqual([
      { skillId: 's', mastery: 0.5, box: 2, nextReviewAt: at, updatedAt: at },
    ]);
  });

  it('marks the demo as seen without overwriting the first time', async () => {
    const { store, query } = setup();
    await store.markDemoSeen('k1', 'l1');
    expect(sqlOf(query)).toContain('COALESCE("level_progress"."demo_seen_at"');
    expect(paramsOf(query)).toEqual(['k1', 'l1']);
  });

  it('reads today’s seconds, 0 without a row', async () => {
    await expect(
      setup([{ seconds: 90 }]).store.secondsOn('k1', '2026-01-01'),
    ).resolves.toBe(90);
    await expect(setup([]).store.secondsOn('k1', '2026-01-01')).resolves.toBe(
      0,
    );
  });

  it('adds activity with an upsert and whole, non-negative seconds', async () => {
    const { store, query } = setup();
    await store.addActivity('k1', '2026-01-01', -3.4, 1);
    expect(sqlOf(query)).toContain(
      'LEAST("daily_activity"."seconds" + EXCLUDED."seconds", 86400)',
    );
    expect(paramsOf(query)).toEqual(['k1', '2026-01-01', 0, 1]);
    await store.addActivity('k1', '2026-01-01', 1e9, 0);
    expect(query.mock.calls[1][1]).toEqual(['k1', '2026-01-01', 86_400, 0]);
  });

  it('reads activity days as text', async () => {
    const { store, query } = setup([
      { day: '2026-01-01', seconds: 1, runs: 1 },
    ]);
    await expect(store.activity('k1', '2025-12-20')).resolves.toHaveLength(1);
    expect(sqlOf(query)).toContain('"day"::text');
  });

  it('inserts attempts idempotently and drops the level in practice', async () => {
    const { store, query } = setup();
    await store.insertAttempt({
      kidId: 'k1',
      runId: 'r1',
      mode: 'practice',
      levelId: 'l1',
      skillId: 's',
      exerciseType: 'compare',
      itemIndex: 3,
      attempt: 2,
      correct: false,
      durationMs: 1200,
    });
    expect(sqlOf(query)).toContain(
      'ON CONFLICT ("run_id", "item_index", "attempt") DO NOTHING',
    );
    expect(paramsOf(query)).toEqual([
      'k1',
      'r1',
      null,
      's',
      'compare',
      3,
      2,
      false,
      1200,
      'practice',
    ]);
  });

  it('keeps the best stars and score and the first pass time', async () => {
    const { store, query } = setup();
    await store.recordLevel(
      'k1',
      { levelId: 'l1', stars: 2, score: 0.8, passed: true },
      { query },
    );
    const sql = sqlOf(query);
    expect(sql).toContain(
      'GREATEST("level_progress"."stars", EXCLUDED."stars")',
    );
    expect(sql).toContain('COALESCE("level_progress"."first_passed_at"');
    expect(paramsOf(query)).toEqual(['k1', 'l1', 2, 0.8, true]);
  });

  it('upserts mastery', async () => {
    const { store, query } = setup();
    const at = new Date();
    await store.saveMastery(
      'k1',
      's',
      { mastery: 0.4, box: 1, nextReviewAt: at },
      { query },
    );
    expect(paramsOf(query)).toEqual(['k1', 's', 0.4, 1, at]);
  });

  it('returns only newly awarded badges, in the given order', async () => {
    const { store, query } = setup([{ badge_id: 'first-world' }]);
    await expect(
      store.awardBadges('k1', ['first-level', 'first-world'], { query }),
    ).resolves.toEqual(['first-world']);
    expect(sqlOf(query)).toContain(
      'ON CONFLICT ("kid_id", "badge_id") DO NOTHING',
    );
    const empty = setup();
    await expect(
      empty.store.awardBadges('k1', [], { query: empty.query }),
    ).resolves.toEqual([]);
    expect(empty.query).not.toHaveBeenCalled();
  });

  it('lists badges', async () => {
    const at = new Date();
    await expect(
      setup([{ badge_id: 'first-level', earned_at: at }]).store.badges('k1'),
    ).resolves.toEqual([{ badgeId: 'first-level', earnedAt: at }]);
  });

  it('locks the kid row and runs transactions', async () => {
    const { store, query, dataSource } = setup();
    await store.transaction((db) => store.lockKid('k1', db));
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(sqlOf(query)).toContain('FOR NO KEY UPDATE');
  });
});
