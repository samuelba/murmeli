import type {
  Level,
  PracticeLadder,
  ProgressState,
  World,
} from '@murmeli/content';
import type { ProgressStates } from '../progress/unlock';
import {
  expectedScore,
  interleave,
  levelOf,
  mixPriority,
  nextAccuracy,
  nextRating,
  planSteps,
  startRating,
  stepOf,
  topicReach,
  worldsAhead,
} from './adaptive';

function ladder(steps: readonly [levelId: string, worldId: string][]) {
  return {
    topic: 'plus',
    trackId: 'math',
    steps: steps.map(([levelId, worldId], index) => ({
      index,
      trackId: 'math',
      worldId,
      level: { id: levelId } as Level,
      specs: [],
    })),
  } as PracticeLadder;
}

function states(
  levels: Record<string, ProgressState>,
  worlds: Record<string, ProgressState>,
): ProgressStates {
  return {
    levels: new Map(Object.entries(levels)),
    worlds: new Map(Object.entries(worlds)),
  };
}

const plus = ladder([
  ['a1', 'a'],
  ['a2', 'a'],
  ['a3', 'a'],
  ['b1', 'b'],
  ['b2', 'b'],
  ['c1', 'c'],
]);

describe('worldsAhead', () => {
  it('lists locked worlds whose required worlds are all open', () => {
    const worlds = [
      { id: 'a', requires: [] },
      { id: 'b', requires: ['a'] },
      { id: 'c', requires: ['b'] },
      { id: 'd', requires: ['a', 'c'] },
    ] as unknown as World[];
    const ahead = worldsAhead(
      worlds,
      states({}, { a: 'unlocked', b: 'locked', c: 'locked', d: 'locked' }),
    );
    expect([...ahead]).toEqual(['b']);
  });
});

describe('topicReach', () => {
  it('is locked when neither the trail nor the next world reaches it', () => {
    expect(
      topicReach(plus, states({ a1: 'locked' }, { a: 'locked' }), new Set()),
    ).toEqual({ state: 'locked', maxStep: -1, pathStep: -1 });
  });

  it('lets a kid try the first steps of the world just ahead', () => {
    expect(
      topicReach(plus, states({}, { a: 'locked' }), new Set(['a'])),
    ).toEqual({ state: 'ahead', maxStep: 1, pathStep: -1 });
  });

  it('reaches two steps beyond the trail in open or nearby worlds', () => {
    const reach = topicReach(
      plus,
      states(
        { a1: 'passed', a2: 'unlocked', a3: 'locked', b1: 'locked' },
        { a: 'unlocked', b: 'locked', c: 'locked' },
      ),
      new Set(['b']),
    );
    expect(reach).toEqual({ state: 'open', maxStep: 3, pathStep: 0 });
  });

  it('stops at a world that is neither open nor next', () => {
    const reach = topicReach(
      plus,
      states(
        { a1: 'passed', a2: 'passed', a3: 'unlocked' },
        { a: 'unlocked', b: 'locked' },
      ),
      new Set(),
    );
    expect(reach.maxStep).toBe(2);
  });

  it('counts placed levels as passed and stops at the ladder end', () => {
    const reach = topicReach(
      plus,
      states(
        {
          a1: 'skipped',
          a2: 'skipped',
          a3: 'skipped',
          b1: 'passed',
          b2: 'passed',
          c1: 'unlocked',
        },
        { a: 'skipped', b: 'passed', c: 'unlocked' },
      ),
      new Set(),
    );
    expect(reach).toEqual({ state: 'open', maxStep: 5, pathStep: 4 });
  });
});

describe('ratings', () => {
  const reach = { state: 'open', maxStep: 3, pathStep: 1 } as const;

  it('starts a new topic at the highest step the trail passed', () => {
    expect(startRating(undefined, reach)).toBe(1.5);
    expect(
      startRating(undefined, { state: 'ahead', maxStep: 1, pathStep: -1 }),
    ).toBe(0.5);
  });

  it('keeps the own rating until the trail moves past it', () => {
    expect(startRating({ rating: 0.4, pathStep: 1 }, reach)).toBe(0.4);
    expect(startRating({ rating: 0.4, pathStep: 0 }, reach)).toBe(1.5);
    expect(startRating({ rating: 2.5, pathStep: 0 }, reach)).toBe(2.5);
  });

  it('never starts beyond reach', () => {
    expect(startRating({ rating: 9, pathStep: 1 }, reach)).toBeCloseTo(3.99);
    expect(
      startRating(
        { rating: 2, pathStep: -1 },
        { state: 'locked', maxStep: -1, pathStep: -1 },
      ),
    ).toBeCloseTo(0.99);
  });

  it('turns ratings into steps and 1-based levels', () => {
    expect(stepOf(2.7, 3)).toBe(2);
    expect(stepOf(5, 3)).toBe(3);
    expect(stepOf(-1, 3)).toBe(0);
    expect(levelOf(2.7, reach)).toBe(3);
    expect(levelOf(2.7, { state: 'locked', maxStep: -1, pathStep: -1 })).toBe(
      0,
    );
  });

  it('expects 80 % at the own step, less above and more below', () => {
    expect(expectedScore(2.5, 2)).toBeCloseTo(0.8, 2);
    expect(expectedScore(2.5, 3)).toBeLessThan(0.5);
    expect(expectedScore(2.5, 1)).toBeGreaterThan(0.94);
  });

  const at = (tier: number, scores: number[]) =>
    scores.map((score) => ({ tier, score }));

  it('moves one step up when everything is right on the first try', () => {
    const all = at(2, Array<number>(10).fill(1));
    expect(Math.floor(nextRating(2, all, 5, 5))).toBe(3);
    expect(Math.floor(nextRating(2.5, all, 5, 5))).toBe(3);
  });

  it('holds a fresh start with three misses and drops with four', () => {
    const misses = (count: number) =>
      at(2, [
        ...Array<number>(10 - count).fill(1),
        ...Array<number>(count).fill(0),
      ]);
    expect(nextRating(2.5, misses(2), 5, 5)).toBeCloseTo(2.5, 1);
    expect(Math.floor(nextRating(2.5, misses(3), 5, 5))).toBe(2);
    expect(Math.floor(nextRating(2.5, misses(4), 5, 5))).toBe(1);
  });

  it('places faster during the first runs and stays in bounds', () => {
    const all = at(0, Array<number>(10).fill(1));
    expect(nextRating(0, all, 0, 5)).toBeGreaterThan(nextRating(0, all, 5, 5));
    expect(nextRating(1.5, at(1, Array<number>(10).fill(1)), 0, 1)).toBeCloseTo(
      1.99,
    );
    expect(nextRating(0.2, at(0, Array<number>(10).fill(0)), 0, 5)).toBe(0);
  });

  it('keeps an accuracy average', () => {
    expect(nextAccuracy(undefined, 3, 4)).toBe(0.75);
    expect(nextAccuracy(1, 0, 10)).toBeCloseTo(0.7);
    expect(nextAccuracy(0.5, 0, 0)).toBe(0.5);
    expect(nextAccuracy(undefined, 0, 0)).toBe(0);
  });
});

describe('planSteps', () => {
  it('starts with a warm-up and spreads stretch items towards the end', () => {
    expect(planSteps(2, 4, 10)).toEqual([1, 2, 2, 2, 2, 2, 3, 2, 2, 2]);
    expect(planSteps(2.7, 4, 10)).toEqual([1, 2, 2, 3, 2, 2, 3, 2, 3, 2]);
  });

  it('keeps at least one item at the own step in short runs', () => {
    expect(planSteps(1.9, 3, 4)).toEqual([0, 1, 2, 2]);
    expect(planSteps(1.9, 3, 2)).toEqual([1, 2]);
  });

  it('has no warm-up at the bottom and no stretch at the top', () => {
    expect(planSteps(0, 3, 4)).toEqual([0, 0, 1, 0]);
    expect(planSteps(3.5, 3, 4)).toEqual([2, 3, 3, 3]);
    expect(planSteps(0, 0, 3)).toEqual([0, 0, 0]);
    expect(planSteps(1, 2, 0)).toEqual([]);
  });
});

describe('interleave', () => {
  it('spreads extra items evenly and never puts one first', () => {
    expect(
      interleave<number | string>([1, 2, 3, 4, 5, 6, 7], ['a', 'b', 'c']),
    ).toEqual([1, 'a', 2, 3, 'b', 4, 5, 'c', 6, 7]);
    expect(interleave<number | string>([1], ['a', 'b'])).toEqual([1, 'a', 'b']);
    expect(interleave<string>([], ['a'])).toEqual(['a']);
    expect(interleave([1, 2], [])).toEqual([1, 2]);
  });
});

describe('mixPriority', () => {
  const now = new Date('2026-11-28T12:00:00Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);

  it('puts due mistakes first, then stale and weak topics', () => {
    const due = mixPriority(
      { dueReviews: 2, lastPracticedAt: daysAgo(0), accuracy: 1 },
      now,
      0,
    );
    const stale = mixPriority(
      { dueReviews: 0, lastPracticedAt: daysAgo(14), accuracy: 0.9 },
      now,
      0,
    );
    const fresh = mixPriority(
      { dueReviews: 0, lastPracticedAt: daysAgo(0), accuracy: 0.9 },
      now,
      0,
    );
    const weak = mixPriority(
      { dueReviews: 0, lastPracticedAt: daysAgo(0), accuracy: 0.3 },
      now,
      0,
    );
    expect(due).toBeGreaterThan(stale);
    expect(stale).toBeGreaterThan(fresh);
    expect(weak).toBeGreaterThan(fresh);
  });

  it('gives never practiced topics a fair chance', () => {
    const never = mixPriority(
      { dueReviews: 0, lastPracticedAt: null, accuracy: undefined },
      now,
      0.5,
    );
    expect(never).toBeCloseTo(1.375);
  });
});
