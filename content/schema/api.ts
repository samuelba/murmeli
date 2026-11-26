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
import type { DemoAction, Grade } from './world.ts';

export const MAX_ATTEMPTS = 2;
export const DAILY_LIMIT_REACHED = 'DAILY_LIMIT_REACHED';

export type PublicExercise<T extends ExerciseTypeId = ExerciseTypeId> = {
  [K in T]: {
    readonly index: number;
    readonly type: K;
    readonly prompt: Prompt;
    readonly payload: Payload<K>;
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

export interface StartRunResponse {
  readonly runId: string;
  readonly items: readonly PublicExercise[];
  readonly demoSeen: boolean;
  readonly demo?: PublicDemo;
}

export type PracticeRunResponse = StartRunResponse;

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
