import { enumerateAddSub } from '../exercises/math.ts';
import type { ExerciseSpec, ExerciseTypeId } from '../exercises/registry.ts';
import type { LocalizedText } from '../locale.ts';

/**
 * The practice topics a kid can pick on the practice ground, in display
 * order. A topic gathers every generator of the curriculum that trains the
 * same thing, so new levels automatically extend its difficulty ladder.
 */
export const PRACTICE_TOPIC_IDS = [
  'count',
  'numbers',
  'ten-frame',
  'compare',
  'number-line',
  'sequence',
  'bonds',
  'plus',
  'minus',
  'wall',
  'times',
  'division',
  'shapes',
  'patterns',
  'clock',
  'calendar',
  'money',
  'letters',
  'initial-sound',
  'syllables',
  'read-words',
  'build-words',
  'writing',
  'dictation',
  'sentences',
] as const;

export type PracticeTopicId = (typeof PRACTICE_TOPIC_IDS)[number];

export const PRACTICE_TOPIC_TITLES: Readonly<
  Record<PracticeTopicId, LocalizedText>
> = {
  count: { 'de-CH': 'Zählen', 'en-US': 'Counting' },
  numbers: { 'de-CH': 'Zahlen erkennen', 'en-US': 'Numbers' },
  'ten-frame': { 'de-CH': 'Zehnerfeld', 'en-US': 'Ten frames' },
  compare: { 'de-CH': 'Vergleichen', 'en-US': 'Comparing' },
  'number-line': { 'de-CH': 'Zahlenstrahl', 'en-US': 'Number line' },
  sequence: { 'de-CH': 'Zahlenreihen', 'en-US': 'Number patterns' },
  bonds: { 'de-CH': 'Zahlenhaus', 'en-US': 'Number bonds' },
  plus: { 'de-CH': 'Plus rechnen', 'en-US': 'Adding' },
  minus: { 'de-CH': 'Minus rechnen', 'en-US': 'Subtracting' },
  wall: { 'de-CH': 'Rechenmauer', 'en-US': 'Number walls' },
  times: { 'de-CH': 'Einmaleins', 'en-US': 'Times tables' },
  division: { 'de-CH': 'Teilen', 'en-US': 'Sharing' },
  shapes: { 'de-CH': 'Formen', 'en-US': 'Shapes' },
  patterns: { 'de-CH': 'Muster', 'en-US': 'Patterns' },
  clock: { 'de-CH': 'Uhr lesen', 'en-US': 'Telling time' },
  calendar: { 'de-CH': 'Tage und Monate', 'en-US': 'Days and months' },
  money: { 'de-CH': 'Geld', 'en-US': 'Money' },
  letters: { 'de-CH': 'Buchstaben', 'en-US': 'Letters' },
  'initial-sound': { 'de-CH': 'Anlaute', 'en-US': 'First sounds' },
  syllables: { 'de-CH': 'Silben', 'en-US': 'Syllables' },
  'read-words': { 'de-CH': 'Wörter lesen', 'en-US': 'Reading words' },
  'build-words': { 'de-CH': 'Wörter bauen', 'en-US': 'Building words' },
  writing: { 'de-CH': 'Schreiben', 'en-US': 'Writing' },
  dictation: { 'de-CH': 'Hören und schreiben', 'en-US': 'Listen and write' },
  sentences: { 'de-CH': 'Sätze lesen', 'en-US': 'Reading sentences' },
};

const TOPIC_OF_TYPE: Readonly<
  Record<Exclude<ExerciseTypeId, 'add-sub' | 'sequence'>, PracticeTopicId>
> = {
  'count-objects': 'count',
  'number-recognition': 'numbers',
  'ten-frame': 'ten-frame',
  compare: 'compare',
  'number-line': 'number-line',
  'number-bond': 'bonds',
  'number-wall': 'wall',
  'shape-pick': 'shapes',
  'times-table': 'times',
  'division-share': 'division',
  clock: 'clock',
  calendar: 'calendar',
  'money-chf': 'money',
  'letter-sound': 'letters',
  'initial-sound': 'initial-sound',
  syllables: 'syllables',
  'word-picture': 'read-words',
  'build-word': 'build-words',
  'trace-letter': 'writing',
  'listen-write': 'dictation',
  'sentence-picture': 'sentences',
};

const OPERATION_OF = { plus: 'add', minus: 'sub' } as const;

export function isPracticeTopicId(id: string): id is PracticeTopicId {
  return (PRACTICE_TOPIC_IDS as readonly string[]).includes(id);
}

/**
 * The part of a generator that trains `topic`, or null. A generator that
 * mixes plus and minus is split into its plus part and its minus part.
 * Returns the same object when nothing had to be narrowed.
 */
export function narrowSpec(
  spec: ExerciseSpec,
  topic: PracticeTopicId,
): ExerciseSpec | null {
  if (spec.type === 'add-sub') {
    if (topic !== 'plus' && topic !== 'minus') {
      return null;
    }
    const operation = OPERATION_OF[topic];
    if (!spec.params.operations.includes(operation)) {
      return null;
    }
    if (spec.params.operations.every((op) => op === operation)) {
      return spec;
    }
    const params = { ...spec.params, operations: [operation] };
    return enumerateAddSub(params).length > 0
      ? { type: 'add-sub', params }
      : null;
  }
  if (spec.type === 'sequence') {
    const kind = topic === 'sequence' ? 'numbers' : 'pattern';
    return (topic === 'sequence' || topic === 'patterns') &&
      spec.params.kind === kind
      ? spec
      : null;
  }
  return TOPIC_OF_TYPE[spec.type] === topic ? spec : null;
}

/** Every topic a generator trains. */
export function topicsOfSpec(spec: ExerciseSpec): PracticeTopicId[] {
  return PRACTICE_TOPIC_IDS.filter((topic) => narrowSpec(spec, topic));
}

/** The topic a generated exercise belongs to. */
export function topicOfExercise(exercise: {
  readonly type: ExerciseTypeId;
  readonly payload: unknown;
}): PracticeTopicId {
  const payload = exercise.payload as { op?: unknown; kind?: unknown };
  if (exercise.type === 'add-sub') {
    return payload.op === 'sub' ? 'minus' : 'plus';
  }
  if (exercise.type === 'sequence') {
    return payload.kind === 'pattern' ? 'patterns' : 'sequence';
  }
  return TOPIC_OF_TYPE[exercise.type];
}
