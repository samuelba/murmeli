import type { z } from 'zod';
import type { PathSegment } from '../issues.ts';
import { clock, divisionShare, moneyChf, timesTable } from './advanced.ts';
import {
  buildWord,
  initialSound,
  letterSound,
  syllables,
  wordPicture,
} from './literacy.ts';
import {
  addSub,
  compare,
  countObjects,
  numberBond,
  numberLine,
  numberRecognition,
  numberWall,
  sequence,
  shapePick,
  tenFrame,
} from './math.ts';
import type { ExerciseTypeDef, ParamIssue } from './types.ts';
import { listenWrite, sentencePicture, traceLetter } from './writing.ts';

export const EXERCISE_TYPES = {
  'count-objects': countObjects,
  'number-recognition': numberRecognition,
  'ten-frame': tenFrame,
  compare,
  'number-line': numberLine,
  'add-sub': addSub,
  'number-bond': numberBond,
  'number-wall': numberWall,
  sequence,
  'shape-pick': shapePick,
  'letter-sound': letterSound,
  'initial-sound': initialSound,
  syllables,
  'word-picture': wordPicture,
  'build-word': buildWord,
  'times-table': timesTable,
  'division-share': divisionShare,
  clock,
  'money-chf': moneyChf,
  'trace-letter': traceLetter,
  'listen-write': listenWrite,
  'sentence-picture': sentencePicture,
} as const;

export type ExerciseTypeId = keyof typeof EXERCISE_TYPES;
export const EXERCISE_TYPE_IDS = Object.keys(
  EXERCISE_TYPES,
) as ExerciseTypeId[];

export type ExerciseParamsSchema<K extends ExerciseTypeId> =
  (typeof EXERCISE_TYPES)[K]['paramsSchema'];
export type ExerciseParams<K extends ExerciseTypeId> = z.output<
  ExerciseParamsSchema<K>
>;
export type ExerciseParamsInput<K extends ExerciseTypeId> = z.input<
  ExerciseParamsSchema<K>
>;

export type ExerciseSpec = {
  [K in ExerciseTypeId]: {
    readonly type: K;
    readonly params: ExerciseParams<K>;
  };
}[ExerciseTypeId];

export const EXERCISE_PARAMS_SCHEMAS = Object.fromEntries(
  EXERCISE_TYPE_IDS.map((id) => [id, EXERCISE_TYPES[id].paramsSchema]),
) as { readonly [K in ExerciseTypeId]: ExerciseParamsSchema<K> };

export function isExerciseTypeId(id: string): id is ExerciseTypeId {
  return Object.hasOwn(EXERCISE_TYPES, id);
}

export function exerciseTypeDef(id: ExerciseTypeId): ExerciseTypeDef {
  return EXERCISE_TYPES[id];
}

export type ParseParamsResult =
  | { readonly success: true; readonly spec: ExerciseSpec }
  | { readonly success: false; readonly issues: readonly ParamIssue[] };

export const MIN_DISTINCT_PROBLEMS = 3;

export interface ParseParamsOptions {
  readonly minDistinct?: number;
}

export function parseExerciseParams(
  type: string,
  raw: unknown,
  options: ParseParamsOptions = {},
): ParseParamsResult {
  if (!isExerciseTypeId(type)) {
    return {
      success: false,
      issues: [
        {
          path: ['type'],
          message: `unknown exercise type "${type}" (known: ${EXERCISE_TYPE_IDS.join(', ')})`,
        },
      ],
    };
  }
  const def = exerciseTypeDef(type);
  const parsed = def.paramsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: ['params', ...(issue.path as PathSegment[])],
        message: issue.message,
      })),
    };
  }
  const issues = def.issues(parsed.data, {
    minDistinct: options.minDistinct ?? MIN_DISTINCT_PROBLEMS,
  });
  if (issues.length > 0) {
    return {
      success: false,
      issues: issues.map((issue) => ({
        ...issue,
        path: ['params', ...issue.path],
      })),
    };
  }
  return { success: true, spec: { type, params: parsed.data } as ExerciseSpec };
}
