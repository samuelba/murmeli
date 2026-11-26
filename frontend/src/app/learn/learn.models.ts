import type {
  Answer,
  AnswerResponse,
  AnyAnswer,
  DemoAction,
  ExerciseTypeId,
  FinishRunResponse,
  HintKey,
  MapLevel,
  MapResponse,
  MapTrack,
  MapWorld,
  Payload,
  ProgressState,
  PublicDemo,
  PublicExercise,
  Stars,
  StartRunResponse,
} from '@murmeli/content';

export type {
  Answer,
  AnswerResponse,
  AnyAnswer,
  DemoAction,
  ExerciseTypeId,
  FinishRunResponse,
  HintKey,
  MapLevel,
  MapResponse,
  MapTrack,
  MapWorld,
  Payload,
  ProgressState,
  PublicDemo,
  PublicExercise,
  Stars,
  StartRunResponse,
};

export const DAILY_LIMIT_REACHED = 'DAILY_LIMIT_REACHED';

export type RunMode = 'level' | 'practice';

export const EXERCISE_TYPE_IDS: readonly ExerciseTypeId[] = [
  'count-objects',
  'number-recognition',
  'ten-frame',
  'compare',
  'number-line',
  'add-sub',
  'number-bond',
  'number-wall',
  'sequence',
  'shape-pick',
  'letter-sound',
  'initial-sound',
  'syllables',
  'word-picture',
  'build-word',
];

/** Item types this player can show; a newer server may send more. */
export function isExerciseType(type: string): type is ExerciseTypeId {
  return (EXERCISE_TYPE_IDS as readonly string[]).includes(type);
}
