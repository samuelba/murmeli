import type { EntityManager } from 'typeorm';
import type { LearningKid } from '../progress/progress.service';
import type { RunItemState, RunState } from '../runs/run-state';
import { PracticeRecorder } from './practice-recorder';
import type { PracticeStore } from './practice.store';

const NOW = new Date('2026-11-28T10:00:00Z');
const kid: LearningKid = {
  id: 'kid-1',
  language: 'de-CH',
  startClass: 'KG1',
  dailyLimitMinutes: null,
};
const db = {} as EntityManager;

function item(
  key: string,
  correctAt: number | null,
  overrides: Partial<RunItemState> = {},
): RunItemState {
  return {
    type: 'add-sub',
    levelId: 'math-plusbruecke-01',
    skillId: 'math.add.to10',
    solution: { answer: { value: 1 }, hint: 'count-on' },
    exercise: {} as RunItemState['exercise'],
    attempts: correctAt ?? 2,
    correctAt,
    key,
    source: { levelId: 'math-plusbruecke-01', generator: 0, seed: 1 },
    topic: 'plus',
    tier: 1,
    ...overrides,
  };
}

function run(
  mode: RunState['mode'],
  items: RunItemState[],
  practice: RunState['practice'] = null,
): RunState {
  return {
    v: 3,
    runId: 'run-1',
    kidId: kid.id,
    levelId: mode === 'level' ? 'math-plusbruecke-01' : null,
    mode,
    topicId: mode === 'practice' ? 'plus' : null,
    practice,
    locale: 'de-CH',
    seed: 1,
    startedAt: 0,
    lastAt: 0,
    activeMs: 0,
    items,
  };
}

function setup() {
  const store = {
    recordSolved: jest.fn().mockResolvedValue(1),
    recordMisses: jest.fn().mockResolvedValue(2),
    saveTopic: jest.fn().mockResolvedValue(undefined),
    addDaily: jest.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    recorder: new PracticeRecorder(store as unknown as PracticeStore),
  };
}

describe('PracticeRecorder', () => {
  it('keeps mistakes of level runs but leaves ratings alone', async () => {
    const { recorder, store } = setup();
    const result = await recorder.record(
      kid,
      run('level', [
        item('right', 1),
        item('second', 2),
        item('missed', null),
        item('open', null, { attempts: 0 }),
      ]),
      '2026-11-28',
      NOW,
      db,
    );
    expect(result).toBeUndefined();
    expect(store.recordSolved).toHaveBeenCalledWith(
      'kid-1',
      ['right'],
      NOW,
      db,
    );
    expect(store.recordMisses).toHaveBeenCalledWith(
      'kid-1',
      'de-CH',
      [
        expect.objectContaining({
          itemKey: 'second',
          topicId: 'plus',
          tier: 1,
        }),
        expect.objectContaining({ itemKey: 'missed' }),
      ],
      NOW,
      db,
    );
    expect(store.saveTopic).not.toHaveBeenCalled();
  });

  it('moves the rating of each practiced topic and counts the day', async () => {
    const { recorder, store } = setup();
    const items = [
      ...Array.from({ length: 9 }, (_, i) => item(`p${i}`, 1)),
      item('p9', null),
      item('p9', 1, { again: 'repeat' }),
    ];
    const result = await recorder.record(
      kid,
      run('practice', items, [
        {
          topic: 'plus',
          rating: 1.5,
          maxStep: 4,
          pathStep: 0,
          runs: 5,
          accuracy: 0.5,
        },
        { topic: 'minus', rating: 0.5, maxStep: 2, pathStep: -1, runs: 0 },
      ]),
      '2026-11-28',
      NOW,
      db,
    );
    expect(store.recordSolved).toHaveBeenCalledWith(
      'kid-1',
      ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
      NOW,
      db,
    );
    expect(store.saveTopic).toHaveBeenCalledTimes(1);
    const [, update] = store.saveTopic.mock.calls[0] as [
      string,
      { rating: number; accuracy: number },
    ];
    expect(update).toMatchObject({
      topicId: 'plus',
      pathStep: 0,
      items: 10,
      firstTry: 9,
    });
    expect(update.rating).toBeGreaterThan(1.5);
    expect(update.accuracy).toBeCloseTo(0.7 * 0.5 + 0.3 * 0.9);
    expect(store.addDaily).toHaveBeenCalledWith(
      'kid-1',
      'plus',
      '2026-11-28',
      10,
      9,
      db,
    );
    expect(result).toEqual({
      topics: [
        {
          id: 'plus',
          title: 'Plus rechnen',
          levelBefore: 2,
          level: 2,
          maxLevel: 5,
        },
      ],
      reviewsSolved: 1,
      reviewsSaved: 2,
    });
  });

  it('reports a step up after a perfect run', async () => {
    const { recorder } = setup();
    const result = await recorder.record(
      kid,
      run(
        'practice',
        Array.from({ length: 10 }, (_, i) => item(`p${i}`, 1)),
        [{ topic: 'plus', rating: 1.5, maxStep: 4, pathStep: 0, runs: 5 }],
      ),
      '2026-11-28',
      NOW,
      db,
    );
    expect(result?.topics[0]).toMatchObject({ levelBefore: 2, level: 3 });
  });

  it('rates first tries only, so second tries do not lift the step', async () => {
    const { recorder, store } = setup();
    const result = await recorder.record(
      kid,
      run(
        'practice',
        [
          ...Array.from({ length: 6 }, (_, i) => item(`f${i}`, 1)),
          ...Array.from({ length: 4 }, (_, i) => item(`s${i}`, 2)),
        ],
        [{ topic: 'plus', rating: 1.5, maxStep: 4, pathStep: 0, runs: 5 }],
      ),
      '2026-11-28',
      NOW,
      db,
    );
    expect(result?.topics[0]).toMatchObject({ levelBefore: 2, level: 1 });
    expect(store.saveTopic.mock.calls[0]?.[1]).toMatchObject({ firstTry: 6 });
  });

  it('counts a topic that only had due mistakes without moving its rating', async () => {
    const { recorder, store } = setup();
    const result = await recorder.record(
      kid,
      run(
        'practice',
        [
          item('count-new', 1, { topic: 'count' }),
          item('plus-review', null, { again: 'review' }),
        ],
        [
          { topic: 'count', rating: 0.5, maxStep: 2, pathStep: -1, runs: 0 },
          { topic: 'plus', rating: 1.5, maxStep: 4, pathStep: 0, runs: 1 },
        ],
      ),
      '2026-11-28',
      NOW,
      db,
    );
    expect(store.saveTopic).toHaveBeenCalledTimes(1);
    expect(store.saveTopic.mock.calls[0]?.[1]).toMatchObject({
      topicId: 'count',
    });
    expect(store.addDaily).toHaveBeenCalledWith(
      'kid-1',
      'plus',
      '2026-11-28',
      1,
      0,
      db,
    );
    expect(result?.topics.map((topic) => topic.id)).toEqual(['count']);
  });

  it('records nothing for a practice run left before the first answer', async () => {
    const { recorder, store } = setup();
    const result = await recorder.record(
      kid,
      run('practice', [item('p0', null, { attempts: 0 })], []),
      '2026-11-28',
      NOW,
      db,
    );
    expect(store.recordSolved).toHaveBeenCalledWith('kid-1', [], NOW, db);
    expect(store.recordMisses).toHaveBeenCalledWith(
      'kid-1',
      'de-CH',
      [],
      NOW,
      db,
    );
    expect(result).toEqual({ topics: [], reviewsSolved: 1, reviewsSaved: 2 });
  });
});
