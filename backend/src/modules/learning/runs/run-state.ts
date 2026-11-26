import {
  type AnswerResponse,
  type ExerciseTypeId,
  type GeneratedItem,
  type Solution,
  MAX_ATTEMPTS,
  checkAnswer,
  itemScore,
  parseAnswer,
  runScore,
} from '@murmeli/content';
import { MAX_ITEM_DURATION_MS, type RunMode } from '../learning.constants';

export interface RunItemState {
  readonly type: ExerciseTypeId;
  readonly levelId: string;
  readonly skillId: string;
  readonly solution: Solution<ExerciseTypeId>;
  readonly attempts: number;
  /** The attempt that was correct, or null */
  readonly correctAt: number | null;
}

export interface RunState {
  readonly v: 1;
  readonly runId: string;
  readonly kidId: string;
  readonly levelId: string | null;
  readonly mode: RunMode;
  readonly seed: number;
  readonly startedAt: number;
  /** When the current item was served: the start or the last answer */
  readonly lastAt: number;
  readonly activeMs: number;
  readonly items: readonly RunItemState[];
}

export interface AttemptRecord {
  readonly itemIndex: number;
  readonly levelId: string;
  readonly skillId: string;
  readonly exerciseType: ExerciseTypeId;
  readonly attempt: number;
  readonly correct: boolean;
  readonly durationMs: number;
}

export type AnswerError = 'ITEM_NOT_FOUND' | 'ITEM_DONE' | 'ANSWER_INVALID';

export type AnswerOutcome =
  | {
      readonly ok: true;
      readonly state: RunState;
      readonly response: AnswerResponse;
      readonly record: AttemptRecord;
    }
  | { readonly ok: false; readonly error: AnswerError };

export interface RunSummary {
  readonly score: number;
  readonly skillScores: ReadonlyMap<string, number>;
  readonly activeSeconds: number;
}

export interface NewRun {
  readonly runId: string;
  readonly kidId: string;
  readonly levelId: string | null;
  readonly mode: RunMode;
  readonly seed: number;
  readonly now: number;
  readonly items: readonly (GeneratedItem & {
    readonly levelId: string;
    readonly skillId: string;
  })[];
}

export function createRunState(run: NewRun): RunState {
  return {
    v: 1,
    runId: run.runId,
    kidId: run.kidId,
    levelId: run.levelId,
    mode: run.mode,
    seed: run.seed,
    startedAt: run.now,
    lastAt: run.now,
    activeMs: 0,
    items: run.items.map((item) => ({
      type: item.type,
      levelId: item.levelId,
      skillId: item.skillId,
      solution: item.solution,
      attempts: 0,
      correctAt: null,
    })),
  };
}

export function isItemDone(item: RunItemState): boolean {
  return item.correctAt !== null || item.attempts >= MAX_ATTEMPTS;
}

function elapsed(from: number, now: number): number {
  return Math.min(MAX_ITEM_DURATION_MS, Math.max(0, Math.round(now - from)));
}

function responseFor(
  item: RunItemState,
  attempt: number,
  correct: boolean,
  hint: AnswerResponse['hint'],
): AnswerResponse {
  if (correct) {
    return { correct, attempt };
  }
  return attempt >= MAX_ATTEMPTS
    ? { correct, attempt, solution: item.solution.answer }
    : { correct, attempt, ...(hint !== undefined && { hint }) };
}

/**
 * One answer to one item: 2 attempts, a hint after a wrong first attempt and
 * the solution after the last one. The time since the item was served (or
 * the last answer) is measured here, capped at five minutes.
 */
export function applyAnswer(
  state: RunState,
  index: number,
  rawAnswer: unknown,
  now: number,
): AnswerOutcome {
  const item = state.items[index];
  if (!Number.isInteger(index) || item === undefined) {
    return { ok: false, error: 'ITEM_NOT_FOUND' };
  }
  if (isItemDone(item)) {
    return { ok: false, error: 'ITEM_DONE' };
  }
  const parsed = parseAnswer(item.type, rawAnswer);
  if (!parsed.success) {
    return { ok: false, error: 'ANSWER_INVALID' };
  }
  const result = checkAnswer(item.solution, parsed.answer);
  const attempt = item.attempts + 1;
  const durationMs = elapsed(state.lastAt, now);
  const updated: RunItemState = {
    ...item,
    attempts: attempt,
    correctAt: result.correct ? attempt : null,
  };
  return {
    ok: true,
    state: {
      ...state,
      lastAt: now,
      activeMs: state.activeMs + durationMs,
      items: state.items.map((it, i) => (i === index ? updated : it)),
    },
    response: responseFor(item, attempt, result.correct, result.hint),
    record: {
      itemIndex: index,
      levelId: item.levelId,
      skillId: item.skillId,
      exerciseType: item.type,
      attempt,
      correct: result.correct,
      durationMs,
    },
  };
}

function itemResult(item: RunItemState): number {
  return item.correctAt === null ? 0 : itemScore(true, item.correctAt);
}

/**
 * Score of a finished run (unanswered items count as 0), the score per skill
 * for mastery, and the learning time. Skills the kid did not answer at all
 * are left out of mastery, so leaving a run early does not count as failing.
 */
export function summarizeRun(state: RunState, now: number): RunSummary {
  const bySkill = new Map<string, number[]>();
  const answered = new Set(
    state.items.filter((item) => item.attempts > 0).map((item) => item.skillId),
  );
  for (const item of state.items.filter((it) => answered.has(it.skillId))) {
    bySkill.set(item.skillId, [
      ...(bySkill.get(item.skillId) ?? []),
      itemResult(item),
    ]);
  }
  return {
    score: runScore(state.items.map(itemResult)),
    skillScores: new Map(
      [...bySkill].map(([skill, scores]) => [skill, runScore(scores)]),
    ),
    activeSeconds: activeSeconds(state, now),
  };
}

/**
 * Learning time of a run: the measured answer times plus the time since the
 * last answer (each capped), or only the answer times for a run that was
 * abandoned and replaced.
 */
export function activeSeconds(
  state: RunState,
  now: number,
  includeTail = true,
): number {
  const tail = includeTail ? elapsed(state.lastAt, now) : 0;
  return Math.ceil((state.activeMs + tail) / 1000);
}
