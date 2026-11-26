import { generateRun } from '@murmeli/content';
import { loadCurriculum } from '../content/curriculum';
import { MAX_ITEM_DURATION_MS } from '../learning.constants';
import {
  type RunState,
  activeSeconds,
  applyAnswer,
  createRunState,
  isItemDone,
  summarizeRun,
} from './run-state';

const curriculum = loadCurriculum(undefined);
const level = curriculum.content.index.levels['math-zahlenwiese-01'].level;
const T0 = 1_800_000_000_000;

function newRun(): RunState {
  const items = generateRun(level, 1234, {
    locale: 'de-CH',
    content: curriculum.content,
  }).map((item) => ({ ...item, levelId: level.id, skillId: level.skill }));
  return createRunState({
    runId: 'run-1',
    kidId: 'kid-1',
    levelId: level.id,
    mode: 'level',
    seed: 1234,
    now: T0,
    items,
  });
}

function solution(state: RunState, index: number): { value: number } {
  return state.items[index].solution.answer as { value: number };
}

function wrong(state: RunState, index: number): { value: number } {
  return { value: solution(state, index).value + 1 };
}

function answer(state: RunState, index: number, value: unknown, at: number) {
  const outcome = applyAnswer(state, index, value, at);
  if (!outcome.ok) {
    throw new Error(outcome.error);
  }
  return outcome;
}

describe('createRunState', () => {
  it('keeps solutions server-side with no attempts yet', () => {
    const state = newRun();
    expect(state.items).toHaveLength(level.items);
    expect(state.items[0]).toMatchObject({
      type: 'count-objects',
      levelId: level.id,
      skillId: level.skill,
      attempts: 0,
      correctAt: null,
    });
    expect(state).toMatchObject({ startedAt: T0, lastAt: T0, activeMs: 0 });
  });
});

describe('applyAnswer', () => {
  it('accepts a correct first answer and records its duration', () => {
    const state = newRun();
    const result = answer(state, 0, solution(state, 0), T0 + 4200);

    expect(result.response).toEqual({ correct: true, attempt: 1 });
    expect(result.record).toEqual({
      itemIndex: 0,
      levelId: level.id,
      skillId: level.skill,
      exerciseType: 'count-objects',
      attempt: 1,
      correct: true,
      durationMs: 4200,
    });
    expect(result.state.items[0]).toMatchObject({ attempts: 1, correctAt: 1 });
    expect(result.state.lastAt).toBe(T0 + 4200);
    expect(isItemDone(result.state.items[0])).toBe(true);
  });

  it('gives a hint after a wrong first attempt and the solution after the second', () => {
    const state = newRun();
    const first = answer(state, 1, wrong(state, 1), T0 + 1000);
    expect(first.response).toEqual({
      correct: false,
      attempt: 1,
      hint: state.items[1].solution.hint,
    });
    expect(first.response).not.toHaveProperty('solution');

    const second = answer(first.state, 1, wrong(state, 1), T0 + 3000);
    expect(second.response).toEqual({
      correct: false,
      attempt: 2,
      solution: solution(state, 1),
    });
    expect(second.record.durationMs).toBe(2000);
    expect(isItemDone(second.state.items[1])).toBe(true);
  });

  it('accepts a correct second attempt without revealing anything', () => {
    const state = newRun();
    const first = answer(state, 2, wrong(state, 2), T0 + 1000);
    const second = answer(first.state, 2, solution(state, 2), T0 + 2000);
    expect(second.response).toEqual({ correct: true, attempt: 2 });
    expect(second.state.items[2].correctAt).toBe(2);
  });

  it('refuses answers to finished items, unknown items and bad shapes', () => {
    const state = newRun();
    const done = answer(state, 0, solution(state, 0), T0 + 10).state;

    expect(applyAnswer(done, 0, solution(state, 0), T0 + 20)).toEqual({
      ok: false,
      error: 'ITEM_DONE',
    });
    expect(applyAnswer(state, 99, { value: 1 }, T0)).toEqual({
      ok: false,
      error: 'ITEM_NOT_FOUND',
    });
    expect(applyAnswer(state, 1.5, { value: 1 }, T0)).toEqual({
      ok: false,
      error: 'ITEM_NOT_FOUND',
    });
    for (const bad of [{ value: 'three' }, { choiceId: 'x' }, null, 3]) {
      expect(applyAnswer(state, 0, bad, T0)).toEqual({
        ok: false,
        error: 'ANSWER_INVALID',
      });
    }
  });

  it('caps the measured time and never counts negative time', () => {
    const state = newRun();
    expect(
      answer(state, 0, solution(state, 0), T0 + 3_600_000).record.durationMs,
    ).toBe(MAX_ITEM_DURATION_MS);
    expect(answer(state, 0, solution(state, 0), T0 - 5).record.durationMs).toBe(
      0,
    );
  });

  it('does not mutate the previous state', () => {
    const state = newRun();
    const snapshot = JSON.stringify(state);
    answer(state, 0, solution(state, 0), T0 + 1);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('summarizeRun', () => {
  it('scores 1 for first-try, 0.5 for second-try and 0 for wrong or unanswered items', () => {
    let state = newRun();
    state = answer(state, 0, solution(state, 0), T0 + 1000).state;
    state = answer(state, 1, wrong(state, 1), T0 + 2000).state;
    state = answer(state, 1, solution(state, 1), T0 + 3000).state;
    state = answer(state, 2, wrong(state, 2), T0 + 4000).state;
    state = answer(state, 2, wrong(state, 2), T0 + 5000).state;

    const summary = summarizeRun(state, T0 + 7000);
    expect(summary.score).toBeCloseTo(1.5 / level.items);
    expect(summary.skillScores.get(level.skill)).toBeCloseTo(1.5 / level.items);
    expect(summary.activeSeconds).toBe(7);
  });

  it('scores a perfect run with 1', () => {
    let state = newRun();
    state.items.forEach((_, i) => {
      state = answer(state, i, solution(state, i), T0 + (i + 1) * 1000).state;
    });
    expect(summarizeRun(state, T0 + 10_000).score).toBe(1);
  });

  it('leaves skills without any answer out of mastery', () => {
    const state = newRun();
    const practice: RunState = {
      ...state,
      items: state.items.map((item, i) => ({
        ...item,
        skillId: i === 0 ? 'played' : 'skipped',
        attempts: i === 0 ? 1 : 0,
        correctAt: i === 0 ? 1 : null,
      })),
    };
    const summary = summarizeRun(practice, T0);
    expect([...summary.skillScores]).toEqual([['played', 1]]);
    expect(summary.score).toBeCloseTo(1 / level.items);
    expect(summarizeRun(newRun(), T0).skillScores.size).toBe(0);
  });

  it('groups scores by skill for practice runs', () => {
    const state = newRun();
    const mixed: RunState = {
      ...state,
      items: state.items.map((item, i) => ({
        ...item,
        skillId: i % 2 === 0 ? 'even' : 'odd',
        attempts: 1,
        correctAt: i % 2 === 0 ? 1 : null,
      })),
    };
    const summary = summarizeRun(mixed, T0);
    expect(summary.skillScores.get('even')).toBe(1);
    expect(summary.skillScores.get('odd')).toBe(0);
  });
});

describe('activeSeconds', () => {
  it('adds the capped time since the last answer unless the run was abandoned', () => {
    const state = { ...newRun(), activeMs: 30_000 };
    expect(activeSeconds(state, T0 + 10_000)).toBe(40);
    expect(activeSeconds(state, T0 + 10_000, false)).toBe(30);
    expect(activeSeconds({ ...state, activeMs: 1 }, T0, false)).toBe(1);
    expect(activeSeconds(state, T0 + 3_600_000)).toBe(
      30 + MAX_ITEM_DURATION_MS / 1000,
    );
  });
});
