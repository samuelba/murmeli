import type { DataSource } from 'typeorm';
import { REVIEWS_PER_TOPIC } from '../learning.constants';
import { PracticeStore } from './practice.store';

function setup(rows: unknown = []) {
  const query = jest.fn().mockResolvedValue(rows);
  return {
    query,
    db: { query },
    store: new PracticeStore({ query } as unknown as DataSource),
  };
}

const sql = (query: jest.Mock, call = 0) => String(query.mock.calls[call][0]);
const params = (query: jest.Mock, call = 0) =>
  query.mock.calls[call][1] as unknown[];
const NOW = new Date('2026-11-28T10:00:00Z');

const rawReview = {
  id: 'r1',
  topic_id: 'plus',
  item_key: 'key1',
  level_id: 'math-plusbruecke-01',
  generator: 0,
  seed: '4294967295',
  source_topic: 'plus',
  tier: 2,
  box: 1,
  misses: 3,
  due_at: NOW,
};

describe('PracticeStore', () => {
  it('maps topic rows and skips retired topics', async () => {
    const { store, query } = setup([
      {
        topic_id: 'plus',
        rating: '2.5',
        path_step: 1,
        runs: 3,
        items: 30,
        first_try: 24,
        accuracy: '0.8',
        demo_seen_at: NOW,
        last_practiced_at: NOW,
      },
      {
        topic_id: 'minus',
        rating: 0.5,
        path_step: -1,
        runs: 0,
        items: 0,
        first_try: 0,
        accuracy: null,
        demo_seen_at: null,
        last_practiced_at: null,
      },
      { topic_id: 'retired' },
    ]);
    await expect(store.topics('k1')).resolves.toEqual([
      {
        topicId: 'plus',
        rating: 2.5,
        pathStep: 1,
        runs: 3,
        items: 30,
        firstTry: 24,
        accuracy: 0.8,
        demoSeen: true,
        lastPracticedAt: NOW,
      },
      {
        topicId: 'minus',
        rating: 0.5,
        pathStep: -1,
        runs: 0,
        items: 0,
        firstTry: 0,
        accuracy: undefined,
        demoSeen: false,
        lastPracticedAt: null,
      },
    ]);
    expect(params(query)).toEqual(['k1']);
  });

  it('marks a demo as seen without touching the rating of a known topic', async () => {
    const { store, query } = setup();
    await store.markDemoSeen('k1', 'plus', 1.5, 1);
    expect(sql(query)).toContain(
      'ON CONFLICT ("kid_id", "topic_id") DO UPDATE',
    );
    expect(sql(query)).toContain('COALESCE');
    expect(sql(query).split('DO UPDATE')[1]).not.toContain('"rating"');
    expect(params(query)).toEqual(['k1', 'plus', 1.5, 1]);
  });

  it('adds a run to the topic and the day', async () => {
    const { store, query, db } = setup();
    await store.saveTopic(
      'k1',
      {
        topicId: 'plus',
        rating: 3.1,
        pathStep: 2,
        items: 10,
        firstTry: 9,
        accuracy: 0.85,
      },
      NOW,
      db,
    );
    expect(sql(query)).toContain(
      '"runs" = "practice_topic_progress"."runs" + 1',
    );
    expect(params(query)).toEqual(['k1', 'plus', 3.1, 2, 10, 9, 0.85, NOW]);
    await store.addDaily('k1', 'plus', '2026-11-28', 10, 9, db);
    expect(sql(query, 1)).toContain('"items" = "practice_daily"."items" +');
    expect(params(query, 1)).toEqual(['k1', 'plus', '2026-11-28', 10, 9]);
  });

  it('reads practice days', async () => {
    const { store, query } = setup([
      { day: '2026-11-28', topic_id: 'plus', items: 4, first_try: 3 },
    ]);
    await expect(store.daily('k1', '2026-11-15')).resolves.toEqual([
      { day: '2026-11-28', topicId: 'plus', items: 4, firstTry: 3 },
    ]);
    expect(params(query)).toEqual(['k1', '2026-11-15']);
  });

  it('counts open and due mistakes per topic of the kid’s language', async () => {
    const { store, query } = setup([
      { topic_id: 'plus', due: 2, total: 5 },
      { topic_id: 'retired', due: 1, total: 1 },
    ]);
    await expect(store.reviewCounts('k1', 'de-CH', NOW)).resolves.toEqual([
      { topicId: 'plus', due: 2, total: 5 },
    ]);
    expect(params(query)).toEqual(['k1', 'de-CH', NOW]);
  });

  it('reads due mistakes with their source, for some or all topics', async () => {
    const { store, query } = setup([
      rawReview,
      { ...rawReview, id: 'r2', source_topic: null },
      { ...rawReview, id: 'r3', source_topic: 'retired' },
      { ...rawReview, id: 'r4', topic_id: 'retired' },
    ]);
    const rows = await store.dueReviews('k1', 'de-CH', NOW, ['plus'], 3);
    expect(rows.map((row) => row.id)).toEqual(['r1', 'r2', 'r3']);
    expect(rows[0]).toEqual({
      id: 'r1',
      topicId: 'plus',
      itemKey: 'key1',
      source: {
        levelId: 'math-plusbruecke-01',
        generator: 0,
        seed: 4294967295,
        topic: 'plus',
      },
      tier: 2,
      box: 1,
      misses: 3,
      dueAt: NOW,
    });
    expect(rows[1].source).not.toHaveProperty('topic');
    expect(rows[2].source).not.toHaveProperty('topic');
    expect(sql(query)).toContain('ORDER BY "misses" DESC');
    expect(params(query)).toEqual(['k1', 'de-CH', NOW, ['plus'], 3]);
    await store.dueReviews('k1', 'de-CH', NOW, null, 3);
    expect(params(query, 1)[3]).toBeNull();
    await store.reviews('k1', 'en-US');
    expect(params(query, 2)).toEqual(['k1', 'en-US']);
  });

  it('deletes outdated mistakes by id', async () => {
    const { store, query } = setup();
    await store.deleteReviews('k1', ['a', 'b']);
    expect(params(query)).toEqual(['k1', ['a', 'b']]);
  });

  it('saves each missed question once, due now, and trims old ones', async () => {
    const { store, query, db } = setup();
    const source = { levelId: 'l1', generator: 1, seed: 7 };
    const saved = await store.recordMisses(
      'k1',
      'de-CH',
      [
        { topicId: 'plus', itemKey: 'a', source, tier: 0 },
        { topicId: 'plus', itemKey: 'a', source, tier: 1 },
        {
          topicId: 'minus',
          itemKey: 'b',
          source: { ...source, topic: 'minus' },
          tier: 2,
        },
      ],
      NOW,
      db,
    );
    expect(saved).toBe(2);
    expect(sql(query)).toContain('ON CONFLICT ("kid_id", "item_key")');
    expect(sql(query)).toContain('"box" = 0');
    expect(params(query)).toEqual([
      'k1',
      'de-CH',
      NOW,
      ['plus', 'minus'],
      ['a', 'b'],
      ['l1', 'l1'],
      [1, 1],
      [7, 7],
      [null, 'minus'],
      [1, 2],
    ]);
    expect(sql(query)).toContain('"updated_at" = clock_timestamp()');
    expect(sql(query, 1)).toContain('PARTITION BY "topic_id", "locale"');
    expect(params(query, 1)).toEqual(['k1', REVIEWS_PER_TOPIC]);
  });

  it('does nothing without misses or solved items', async () => {
    const { store, query, db } = setup();
    await expect(store.recordMisses('k1', 'de-CH', [], NOW, db)).resolves.toBe(
      0,
    );
    await expect(store.recordSolved('k1', [], NOW, db)).resolves.toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('moves solved mistakes up a box and removes them after the last one', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([[], 1])
      .mockResolvedValueOnce([[], 2]);
    const store = new PracticeStore({ query } as unknown as DataSource);
    await expect(
      store.recordSolved('k1', ['a', 'b', 'a', 'c'], NOW, { query }),
    ).resolves.toBe(3);
    expect(sql(query)).toMatch(/^DELETE FROM "practice_reviews"/);
    expect(params(query)).toEqual(['k1', ['a', 'b', 'c'], 2, NOW]);
    expect(sql(query)).toContain('"due_at" <= $4');
    expect(sql(query, 1)).toContain('"due_at" <= $3');
    expect(sql(query, 1)).toContain('"box" = "box" + 1');
    expect(sql(query, 1)).toContain('WHEN 0 THEN 1 ELSE 3');
    expect(params(query, 1)).toEqual(['k1', ['a', 'b', 'c'], NOW, 2]);
  });

  it('counts no rows when the driver reports none', async () => {
    const query = jest.fn().mockResolvedValue([[], undefined]);
    const store = new PracticeStore({ query } as unknown as DataSource);
    await expect(store.recordSolved('k1', ['a'], NOW, { query })).resolves.toBe(
      0,
    );
  });
});
