import { z } from 'zod';
import type { Prompt } from './exercises/frames.ts';
import type { ExerciseTypeId } from './exercises/registry.ts';
import type {
  AnyAnswer,
  GeneratedExercise,
  GeneratedItem,
  Payload,
} from './runtime/exercise.ts';
import type { DemoInstance } from './runtime/exercise.ts';
import type { HintKey } from './runtime/hints.ts';
import type { PracticeTopicId } from './practice/topics.ts';
import type { DemoAction, Grade } from './world.ts';

export const MAX_ATTEMPTS = 2;
export const DAILY_LIMIT_REACHED = 'DAILY_LIMIT_REACHED';

/**
 * Why a practice item is shown again: `review` is a mistake from an earlier
 * run, `repeat` one from earlier in this run (after its solution was shown).
 */
export type AgainReason = 'review' | 'repeat';

export type PublicExercise<T extends ExerciseTypeId = ExerciseTypeId> = {
  [K in T]: {
    readonly index: number;
    readonly type: K;
    readonly prompt: Prompt;
    readonly payload: Payload<K>;
    readonly again?: AgainReason;
  };
}[T];

export interface PublicDemo {
  readonly type: ExerciseTypeId;
  readonly prompt: Prompt;
  readonly payload: Payload<ExerciseTypeId>;
  readonly answer: AnyAnswer;
  readonly steps: readonly {
    readonly say: string;
    readonly action: DemoAction;
  }[];
}

/** How far one item of a resumed run got: the attempts used and whether one was correct. */
export interface RunItemProgress {
  readonly attempts: number;
  readonly correct: boolean;
}

/** Where a practice run starts on its topic's ladder (1-based steps). */
export interface PracticeRunInfo {
  /** null for "Murmeli wählt", a mix of topics */
  readonly topic: PracticeTopicId | null;
  readonly level: number;
  readonly maxLevel: number;
}

export interface StartRunResponse {
  readonly runId: string;
  readonly items: readonly PublicExercise[];
  readonly demoSeen: boolean;
  readonly demo?: PublicDemo;
  /** Only when an unfinished run of the same level (or practice) is resumed, one per item. */
  readonly progress?: readonly RunItemProgress[];
  /** Only for a practice run */
  readonly practice?: PracticeRunInfo;
}

export type PracticeRunResponse = StartRunResponse;

/** `POST /api/learn/practice/runs`: a topic, or nothing for "Murmeli wählt". */
export interface StartPracticeRequest {
  readonly topic?: PracticeTopicId;
}

/**
 * - `open`: the trail reached the topic.
 * - `ahead`: the trail is close; the kid may already try the first steps.
 * - `locked`: too far ahead on the trail.
 */
export type PracticeTopicState = 'open' | 'ahead' | 'locked';

export interface PracticeTopicView {
  readonly id: PracticeTopicId;
  readonly title: string;
  readonly state: PracticeTopicState;
  /** 1-based step the next run trains; 0 while locked */
  readonly level: number;
  /** The highest step reachable now: the trail plus a little ahead */
  readonly maxLevel: number;
  /** All steps of the topic */
  readonly levels: number;
  /** Earlier mistakes that are due to be asked again */
  readonly dueReviews: number;
  readonly practiced: boolean;
}

export interface PracticeTrackView {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly topics: readonly PracticeTopicView[];
}

/** `GET /api/learn/practice`: the practice ground. */
export interface PracticeCatalogResponse {
  readonly tracks: readonly PracticeTrackView[];
  /** "Murmeli wählt": mixes open topics and due mistakes */
  readonly mix: {
    readonly available: boolean;
    readonly dueReviews: number;
  };
}

export interface PracticeTopicResult {
  readonly id: PracticeTopicId;
  readonly title: string;
  readonly levelBefore: number;
  readonly level: number;
  readonly maxLevel: number;
}

export interface PracticeResult {
  readonly topics: readonly PracticeTopicResult[];
  /** Earlier mistakes answered right on the first try */
  readonly reviewsSolved: number;
  /** Mistakes kept to be asked again in a later run */
  readonly reviewsSaved: number;
}

export interface AnswerRequest {
  readonly index: number;
  readonly answer: AnyAnswer;
}

export const AnswerRequestSchema = z.strictObject({
  index: z.number().int().min(0).max(49),
  answer: z.unknown(),
});

export interface AnswerResponse {
  readonly correct: boolean;
  readonly attempt: number;
  readonly hint?: HintKey;
  readonly solution?: AnyAnswer;
  /** Practice only: the missed item, appended to the run to try once more */
  readonly repeat?: PublicExercise;
}

export type Stars = 0 | 1 | 2 | 3;

export interface FinishRunResponse {
  readonly score: number;
  readonly stars: Stars;
  readonly passed: boolean;
  readonly unlocked: {
    readonly levels: readonly string[];
    readonly worlds: readonly string[];
  };
  readonly newBadges: readonly string[];
  /** Only for a practice run */
  readonly practice?: PracticeResult;
}

export type ProgressState = 'locked' | 'unlocked' | 'passed' | 'skipped';

export interface MapLevel {
  readonly id: string;
  readonly title: string;
  readonly state: ProgressState;
  readonly stars: Stars;
}

export interface MapWorld {
  readonly id: string;
  readonly title: string;
  readonly scene: string;
  readonly grade: Grade;
  readonly state: ProgressState;
  readonly stars: number;
  readonly maxStars: number;
  readonly levels: readonly MapLevel[];
}

export interface MapTrack {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly worlds: readonly MapWorld[];
}

export interface MapResponse {
  readonly tracks: readonly MapTrack[];
  /** Ids of the badges the kid has earned, oldest first. */
  readonly badges: readonly string[];
}

export function toPublicExercise(item: GeneratedItem): PublicExercise {
  return {
    index: item.index,
    type: item.type,
    prompt: item.prompt,
    payload: item.payload,
  } as PublicExercise;
}

export function toPublicDemo(demo: DemoInstance): PublicDemo {
  const exercise: GeneratedExercise = demo.exercise;
  return {
    type: exercise.type,
    prompt: exercise.prompt,
    payload: exercise.payload,
    answer: exercise.solution.answer,
    steps: demo.steps,
  };
}

export function itemScore(correct: boolean, attempt: number): number {
  if (!correct) {
    return 0;
  }
  return attempt <= 1 ? 1 : attempt === 2 ? 0.5 : 0;
}

export function runScore(itemScores: readonly number[]): number {
  return itemScores.length === 0
    ? 0
    : itemScores.reduce((sum, s) => sum + s, 0) / itemScores.length;
}

export function starsFor(score: number, passRatio: number): Stars {
  if (score >= 1) {
    return 3;
  }
  if (score >= passRatio) {
    return 2;
  }
  return score >= 0.5 ? 1 : 0;
}

export function isPassed(stars: Stars): boolean {
  return stars >= 2;
}
