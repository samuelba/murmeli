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
import { narrowSpec } from '../practice/topics.ts';
import type { PracticeTopicId } from '../practice/topics.ts';
import { scoreTrace } from './trace.ts';
import { exerciseKey } from './variety.ts';
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

/** How an item was made, so the very same exercise can be shown again later. */
export interface ItemSource {
  readonly levelId: string;
  /** Index into the level's generators */
  readonly generator: number;
  /** Seed of the exercise's own random numbers */
  readonly seed: number;
  /** Set when the generator was narrowed to one practice topic */
  readonly topic?: PracticeTopicId;
}

export type GeneratedItem = GeneratedExercise & {
  readonly index: number;
  /** See exerciseKey: equal keys ask the same question */
  readonly key: string;
  readonly source: ItemSource;
};

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

const VARIETY_TRIES = 12;
const EXERCISE_SALT = 0x5eed;
const BEST = 7;

/** A generator of a level, possibly narrowed to one practice topic. */
export interface SourceSpec {
  readonly spec: ExerciseSpec;
  readonly weight: number;
  /** Index into the level's generators */
  readonly generator: number;
}

export type ItemHistory = readonly Pick<
  GeneratedItem,
  'key' | 'type' | 'focus'
>[];

/** New to the run beats not seen in the last two items beats a new focus. */
function varietyScore(
  candidate: Pick<GeneratedItem, 'key' | 'type' | 'focus'>,
  history: ItemHistory,
  used: ReadonlySet<string>,
): number {
  const previous = history[history.length - 1];
  const recent = history.slice(-2).some((item) => item.key === candidate.key);
  const sameFocus =
    previous !== undefined &&
    previous.type === candidate.type &&
    previous.focus === candidate.focus;
  return (
    (used.has(candidate.key) ? 0 : 4) + (recent ? 0 : 2) + (sameFocus ? 0 : 1)
  );
}

/**
 * Generates one item from weighted generators, retrying with derived seeds
 * until the exercise is new to the run (`history`). With a small pool it
 * settles for one that was not among the last two items. Deterministic for
 * the same arguments.
 */
export function generateVaried(
  levelId: string,
  specs: readonly SourceSpec[],
  baseSeed: number,
  index: number,
  options: GenerateOptions,
  history: ItemHistory = [],
  topic?: PracticeTopicId,
): GeneratedItem {
  const used = new Set(history.map((item) => item.key));
  let best: GeneratedItem | undefined;
  let bestScore = -1;
  for (let attempt = 0; attempt < VARIETY_TRIES; attempt += 1) {
    const seed = attempt === 0 ? baseSeed : mixSeed(baseSeed, attempt);
    const chosen = createRng(seed).weighted(specs, (s) => s.weight);
    const exerciseSeed = mixSeed(seed, EXERCISE_SALT);
    const exercise = generateExercise(
      chosen.spec,
      createRng(exerciseSeed),
      options,
    );
    const item: GeneratedItem = {
      ...exercise,
      index,
      key: exerciseKey(exercise),
      source: {
        levelId,
        generator: chosen.generator,
        seed: exerciseSeed,
        ...(topic !== undefined ? { topic } : {}),
      },
    };
    const score = varietyScore(item, history, used);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
    if (score === BEST) {
      break;
    }
  }
  return best!;
}

export function levelSpecs(level: Level): SourceSpec[] {
  return level.generators.map((spec, generator) => ({
    spec,
    weight: spec.weight,
    generator,
  }));
}

export function generateItem(
  level: Level,
  runSeed: number,
  index: number,
  options: GenerateOptions,
  history: ItemHistory = [],
): GeneratedItem {
  return generateVaried(
    level.id,
    levelSpecs(level),
    itemSeed(runSeed, level.id, index),
    index,
    options,
    history,
  );
}

export function generateRun(
  level: Level,
  runSeed: number,
  options: GenerateOptions,
  count: number = level.items,
): GeneratedItem[] {
  const items: GeneratedItem[] = [];
  for (let index = 0; index < count; index += 1) {
    items.push(generateItem(level, runSeed, index, options, items));
  }
  return items;
}

/**
 * The exercise an item source made, again: the same question with the same
 * answer. Undefined when the level or generator no longer exists or no
 * longer fits the topic; a generator error is thrown.
 */
export function regenerateExercise(
  levels: Readonly<Record<string, { readonly level: Level } | undefined>>,
  source: ItemSource,
  options: GenerateOptions,
): GeneratedExercise | undefined {
  const generator = levels[source.levelId]?.level.generators[source.generator];
  if (generator === undefined) {
    return undefined;
  }
  const spec =
    source.topic === undefined
      ? generator
      : narrowSpec(generator, source.topic);
  return spec === null
    ? undefined
    : generateExercise(spec, createRng(source.seed), options);
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
