import type { DataSource } from 'typeorm';
import { ProgressExportService } from './progress-export.service';

describe('ProgressExportService', () => {
  it('exports nothing without kids', async () => {
    const query = jest.fn();
    const service = new ProgressExportService({
      query,
    } as unknown as DataSource);
    await expect(service.forKids([])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('groups every progress table by kid', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const results = [
      [
        {
          kid_id: 'k1',
          level_id: 'l1',
          stars: 2,
          best_score: 0.8,
          runs: 1,
          first_passed_at: at,
          demo_seen_at: null,
          updated_at: at,
        },
      ],
      [
        {
          kid_id: 'k2',
          skill_id: 's',
          mastery: 0.5,
          box: 1,
          next_review_at: at,
          updated_at: at,
        },
      ],
      [{ kid_id: 'k1', day: '2026-01-01', seconds: 60, runs: 1 }],
      [{ kid_id: 'k1', badge_id: 'first-level', earned_at: at }],
      [
        {
          kid_id: 'k1',
          topic_id: 'plus',
          rating: 2.5,
          path_step: 1,
          runs: 3,
          items: 30,
          first_try: 25,
          accuracy: 0.8,
          demo_seen_at: at,
          last_practiced_at: null,
          updated_at: at,
        },
        {
          kid_id: 'k2',
          topic_id: 'count',
          rating: 0.5,
          path_step: -1,
          runs: 0,
          items: 0,
          first_try: 0,
          accuracy: null,
          demo_seen_at: null,
          last_practiced_at: null,
          updated_at: at,
        },
      ],
      [
        {
          kid_id: 'k1',
          day: '2026-01-01',
          topic_id: 'plus',
          items: 10,
          first_try: 9,
        },
      ],
      [
        {
          kid_id: 'k1',
          topic_id: 'plus',
          locale: 'de-CH',
          item_key: 'abc',
          level_id: 'math-plusbruecke-01',
          generator: 0,
          seed: '4294967295',
          source_topic: null,
          tier: 0,
          box: 1,
          misses: 2,
          due_at: at,
          created_at: at,
        },
      ],
      [
        {
          kid_id: 'k1',
          skill_id: 's',
          mode: 'level',
          attempts: 7,
          correct: 6,
          first_at: at,
          last_at: at,
        },
      ],
    ];
    let call = 0;
    const query = jest.fn(
      (sql: string, params: unknown[]): Promise<unknown> => {
        expect(params).toEqual([['k1', 'k2']]);
        expect(sql).toContain('ANY($1::uuid[])');
        return Promise.resolve(results[call++]);
      },
    );
    const service = new ProgressExportService({
      query,
    } as unknown as DataSource);

    const [k1, k2] = await service.forKids(['k1', 'k2']);
    expect(query).toHaveBeenCalledTimes(8);
    expect(k1).toEqual({
      kidId: 'k1',
      levels: [
        {
          levelId: 'l1',
          stars: 2,
          bestScore: 0.8,
          runs: 1,
          firstPassedAt: '2026-01-01T00:00:00.000Z',
          demoSeenAt: null,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      skills: [],
      activity: [{ day: '2026-01-01', seconds: 60, runs: 1 }],
      badges: [
        { badgeId: 'first-level', earnedAt: '2026-01-01T00:00:00.000Z' },
      ],
      practiceTopics: [
        {
          topicId: 'plus',
          rating: 2.5,
          pathStep: 1,
          runs: 3,
          items: 30,
          firstTry: 25,
          accuracy: 0.8,
          demoSeenAt: '2026-01-01T00:00:00.000Z',
          lastPracticedAt: null,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      practiceDays: [
        { day: '2026-01-01', topicId: 'plus', items: 10, firstTry: 9 },
      ],
      practiceReviews: [
        {
          topicId: 'plus',
          locale: 'de-CH',
          itemKey: 'abc',
          levelId: 'math-plusbruecke-01',
          generator: 0,
          seed: 4294967295,
          sourceTopic: null,
          tier: 0,
          box: 1,
          misses: 2,
          dueAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      attempts: [
        {
          skillId: 's',
          mode: 'level',
          attempts: 7,
          correct: 6,
          firstAt: '2026-01-01T00:00:00.000Z',
          lastAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(k2.skills).toHaveLength(1);
    expect(k2.levels).toEqual([]);
    expect(k2.practiceTopics).toEqual([
      expect.objectContaining({ topicId: 'count', accuracy: null }),
    ]);
  });
});
