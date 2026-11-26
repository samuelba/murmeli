import type { Locale } from '../locale.ts';
import type { PromptContent } from '../exercises/frames.ts';
import type {
  ExerciseParams,
  ExerciseSpec,
  ExerciseTypeId,
} from '../exercises/registry.ts';
import type { DemoAction, Level } from '../world.ts';
import { deepEqual } from './helpers.ts';
import {
  buildWordRuntime,
  initialSoundRuntime,
  letterSoundRuntime,
  syllablesRuntime,
  wordPictureRuntime,
} from './literacy.ts';
import {
  addSubRuntime,
  compareRuntime,
  countObjectsRuntime,
  numberBondRuntime,
  numberLineRuntime,
  numberRecognitionRuntime,
  numberWallRuntime,
  sequenceRuntime,
  shapePickRuntime,
  tenFrameRuntime,
} from './math.ts';
import {
  clockRuntime,
  divisionShareRuntime,
  moneyRuntime,
  timesTableRuntime,
} from './advanced.ts';
import {
  listenWriteRuntime,
  sentencePictureRuntime,
  traceLetterRuntime,
} from './writing.ts';
import { scoreTrace } from './trace.ts';
import { CoinsAnswerSchema, StrokesAnswerSchema } from './answers.ts';
import { createRng, hashString, itemSeed, mixSeed } from './rng.ts';
import type { Rng } from './rng.ts';
import type {
  CheckResult,
  CheckRule,
  ExerciseRuntime,
  RuntimeContext,
  Solution as SolutionOf,
} from './types.ts';
import type { Prompt } from '../exercises/frames.ts';

export const EXERCISE_RUNTIMES = {
  'count-objects': countObjectsRuntime,
  'number-recognition': numberRecognitionRuntime,
  'ten-frame': tenFrameRuntime,
  compare: compareRuntime,
  'number-line': numberLineRuntime,
  'add-sub': addSubRuntime,
  'number-bond': numberBondRuntime,
  'number-wall': numberWallRuntime,
  sequence: sequenceRuntime,
  'shape-pick': shapePickRuntime,
  'letter-sound': letterSoundRuntime,
  'initial-sound': initialSoundRuntime,
  syllables: syllablesRuntime,
  'word-picture': wordPictureRuntime,
  'build-word': buildWordRuntime,
  'times-table': timesTableRuntime,
  'division-share': divisionShareRuntime,
  clock: clockRuntime,
  'money-chf': moneyRuntime,
  'trace-letter': traceLetterRuntime,
  'listen-write': listenWriteRuntime,
  'sentence-picture': sentencePictureRuntime,
} as const satisfies {
  [K in ExerciseTypeId]: ExerciseRuntime<ExerciseParams<K>, unknown, unknown>;
};

type RuntimeOf<T extends ExerciseTypeId> = (typeof EXERCISE_RUNTIMES)[T];

export type Payload<T extends ExerciseTypeId> = ReturnType<
  RuntimeOf<T>['generate']
>['payload'];
export type Answer<T extends ExerciseTypeId> = ReturnType<
  RuntimeOf<T>['generate']
>['solution']['answer'];
export type Solution<T extends ExerciseTypeId> = SolutionOf<Answer<T>>;
export type AnyAnswer = Answer<ExerciseTypeId>;
export type AnyPayload = Payload<ExerciseTypeId>;

export type GeneratedExercise<T extends ExerciseTypeId = ExerciseTypeId> = {
  [K in T]: {
    readonly type: K;
    readonly prompt: Prompt;
    readonly payload: Payload<K>;
    readonly solution: Solution<K>;
    readonly focus: string | number;
  };
}[T];

export type GeneratedItem = GeneratedExercise & { readonly index: number };

export interface GenerateOptions {
  readonly locale: Locale;
  readonly content: PromptContent;
}

function runtimeOf(
  type: ExerciseTypeId,
): ExerciseRuntime<unknown, unknown, unknown> {
  return EXERCISE_RUNTIMES[type];
}

export function generateExercise(
  spec: ExerciseSpec,
  rng: Rng,
  ctx: RuntimeContext,
): GeneratedExercise {
  const generated = runtimeOf(spec.type).generate(rng, spec.params, ctx);
  return { type: spec.type, ...generated } as GeneratedExercise;
}

export type ParseAnswerResult =
  | { readonly success: true; readonly answer: AnyAnswer }
  | { readonly success: false };

export function parseAnswer(
  type: ExerciseTypeId,
  raw: unknown,
): ParseAnswerResult {
  const result = runtimeOf(type).answerSchema.safeParse(raw);
  return result.success
    ? { success: true, answer: result.data as AnyAnswer }
    : { success: false };
}

function checkRule(rule: CheckRule, answer: unknown): CheckResult | boolean {
  if (rule.kind === 'coin-sum') {
    const parsed = CoinsAnswerSchema.safeParse(answer);
    return (
      parsed.success &&
      parsed.data.coins.every((id) => rule.values[id] !== undefined) &&
      parsed.data.coins.reduce((sum, id) => sum + (rule.values[id] ?? 0), 0) ===
        rule.amount
    );
  }
  const parsed = StrokesAnswerSchema.safeParse(answer);
  if (!parsed.success) {
    return false;
  }
  const { correct, hint } = scoreTrace(rule.glyph, parsed.data.strokes, rule);
  return hint === undefined ? { correct } : { correct, hint };
}

export function checkAnswer(
  solution: SolutionOf<unknown>,
  answer: unknown,
): CheckResult {
  const outcome =
    solution.rule !== undefined
      ? checkRule(solution.rule, answer)
      : deepEqual(solution.answer, answer);
  if (typeof outcome !== 'boolean') {
    return outcome;
  }
  return outcome ? { correct: true } : { correct: false, hint: solution.hint };
}

const RETRIES = 6;

export function generateItem(
  level: Level,
  runSeed: number,
  index: number,
  options: GenerateOptions,
  avoid?: GeneratedExercise,
): GeneratedItem {
  const base = itemSeed(runSeed, level.id, index);
  let item: GeneratedExercise | undefined;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    const rng = createRng(attempt === 0 ? base : mixSeed(base, attempt));
    const generator = rng.weighted(level.generators, (g) => g.weight);
    item = generateExercise(generator, rng, options);
    if (
      avoid === undefined ||
      avoid.type !== item.type ||
      avoid.focus !== item.focus
    ) {
      break;
    }
  }
  return { ...item!, index };
}

export function generateRun(
  level: Level,
  runSeed: number,
  options: GenerateOptions,
  count: number = level.items,
): GeneratedItem[] {
  const items: GeneratedItem[] = [];
  for (let index = 0; index < count; index += 1) {
    items.push(generateItem(level, runSeed, index, options, items[index - 1]));
  }
  return items;
}

export interface DemoInstance {
  readonly exercise: GeneratedExercise;
  readonly target?: string | number;
  readonly steps: readonly {
    readonly say: string;
    readonly action: DemoAction;
  }[];
}

export function demoSeed(levelId: string): number {
  return hashString(`demo:${levelId}`);
}

export function generateDemo(
  level: Level,
  locale: Locale,
  content: PromptContent,
): DemoInstance {
  const rng = createRng(demoSeed(level.id));
  const target = level.demo.target;
  const exercise = generateExercise(level.demo.exercise, rng, {
    locale,
    content,
    demo: target !== undefined ? { target } : {},
  });
  return {
    exercise,
    ...(target !== undefined ? { target } : {}),
    steps: level.demo.steps.map((step) => ({
      say: step.say[locale] ?? '',
      action: step.action,
    })),
  };
}
