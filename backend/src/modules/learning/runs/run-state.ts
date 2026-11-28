import {
  type AgainReason,
  type AnswerResponse,
  type ExerciseTypeId,
  type GeneratedItem,
  type ItemSource,
  type Locale,
  type PracticeTopicId,
  type PublicExercise,
  type RunItemProgress,
  type Solution,
  MAX_ATTEMPTS,
  checkAnswer,
  itemScore,
  parseAnswer,
  runScore,
  toPublicExercise,
} from '@murmeli/content';
import {
  MAX_ITEM_DURATION_MS,
  PRACTICE_MAX_REPEATS,
  type RunMode,
} from '../learning.constants';

export interface RunItemState {
  readonly type: ExerciseTypeId;
  readonly levelId: string;
  readonly skillId: string;
  readonly solution: Solution<ExerciseTypeId>;
  /** What the client was sent, so the run can be resumed after a reload */
  readonly exercise: PublicExercise;
  readonly attempts: number;
  /** The attempt that was correct, or null */
  readonly correctAt: number | null;
  /** See exerciseKey: the same question has the same key */
  readonly key: string;
  readonly source: ItemSource;
  readonly topic: PracticeTopicId;
  /** The item's step on its topic's ladder */
  readonly tier: number;
  readonly again?: AgainReason;
}

/** Where a practice run started on one of its topics, for the update at the finish. */
export interface PracticeTopicStart {
  readonly topic: PracticeTopicId;
  readonly rating: number;
  readonly maxStep: number;
  readonly pathStep: number;
  readonly runs: number;
  readonly accuracy?: number;
}

export interface RunState {
  readonly v: 3;
  readonly runId: string;
  readonly kidId: string;
  readonly levelId: string | null;
  readonly mode: RunMode;
  /** The practice topic, null for a level run and "Murmeli wählt" */
  readonly topicId: PracticeTopicId | null;
  /** Practice runs only: one entry per topic of the run */
  readonly practice: readonly PracticeTopicStart[] | null;
  readonly locale: Locale;
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

export type RunItem = GeneratedItem & {
  readonly levelId: string;
  readonly skillId: string;
  readonly topic: PracticeTopicId;
  readonly tier: number;
  readonly again?: AgainReason;
};

export interface NewRun {
  readonly runId: string;
  readonly kidId: string;
  readonly levelId: string | null;
  readonly mode: RunMode;
  readonly topicId?: PracticeTopicId | null;
  readonly practice?: readonly PracticeTopicStart[] | null;
  readonly locale: Locale;
  readonly seed: number;
  readonly now: number;
  readonly items: readonly RunItem[];
}

/** What the client sees of an item: no solution, no source. */
export function publicItem(item: RunItem): PublicExercise {
  const exercise = toPublicExercise(item);
  return item.again === undefined
    ? exercise
    : { ...exercise, again: item.again };
}

export function createRunState(run: NewRun): RunState {
  return {
    v: 3,
    runId: run.runId,
    kidId: run.kidId,
    levelId: run.levelId,
    mode: run.mode,
    topicId: run.topicId ?? null,
    practice: run.practice ?? null,
    locale: run.locale,
    seed: run.seed,
    startedAt: run.now,
    lastAt: run.now,
    activeMs: 0,
    items: run.items.map((item) => ({
      type: item.type,
      levelId: item.levelId,
      skillId: item.skillId,
      solution: item.solution,
      exercise: publicItem(item),
      attempts: 0,
      correctAt: null,
      key: item.key,
      source: item.source,
      topic: item.topic,
      tier: item.tier,
      ...(item.again !== undefined ? { again: item.again } : {}),
    })),
  };
}

/** Items counted for scores, mastery and the practice rating: not the in-run repeats. */
export function scoredItems(state: RunState): RunItemState[] {
  return state.items.filter((item) => item.again !== 'repeat');
}

/** A missed practice item comes once more at the end of the run. */
function repeatOf(
  state: RunState,
  item: RunItemState,
): RunItemState | undefined {
  const repeats = state.items.filter((it) => it.again === 'repeat').length;
  if (
    state.mode !== 'practice' ||
    item.again === 'repeat' ||
    repeats >= PRACTICE_MAX_REPEATS
  ) {
    return undefined;
  }
  const index = state.items.length;
  return {
    ...item,
    attempts: 0,
    correctAt: null,
    again: 'repeat',
    exercise: { ...item.exercise, index, again: 'repeat' },
  };
}

export function isItemDone(item: RunItemState): boolean {
  return item.correctAt !== null || item.attempts >= MAX_ATTEMPTS;
}

export function runProgress(state: RunState): RunItemProgress[] {
  return state.items.map((item) => ({
    attempts: item.attempts,
    correct: item.correctAt !== null,
  }));
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
  const missed = !result.correct && attempt >= MAX_ATTEMPTS;
  const repeat = missed ? repeatOf(state, item) : undefined;
  const response = responseFor(item, attempt, result.correct, result.hint);
  return {
    ok: true,
    state: {
      ...state,
      lastAt: now,
      activeMs: state.activeMs + durationMs,
      items: [
        ...state.items.map((it, i) => (i === index ? updated : it)),
        ...(repeat ? [repeat] : []),
      ],
    },
    response: repeat ? { ...response, repeat: repeat.exercise } : response,
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

export function itemResult(item: RunItemState): number {
  return item.correctAt === null ? 0 : itemScore(true, item.correctAt);
}

/**
 * Score of a finished run (unanswered items count as 0), the score per skill
 * for mastery, and the learning time. Skills the kid did not answer at all
 * are left out of mastery, so leaving a run early does not count as failing.
 * Repeats of missed items within the run count only as learning time.
 */
export function summarizeRun(state: RunState, now: number): RunSummary {
  const items = scoredItems(state);
  const bySkill = new Map<string, number[]>();
  const answered = new Set(
    items.filter((item) => item.attempts > 0).map((item) => item.skillId),
  );
  for (const item of items.filter((it) => answered.has(it.skillId))) {
    bySkill.set(item.skillId, [
      ...(bySkill.get(item.skillId) ?? []),
      itemResult(item),
    ]);
  }
  return {
    score: runScore(items.map(itemResult)),
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
