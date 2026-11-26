import type { Payload, PublicDemo, PublicExercise, StartRunResponse } from '@murmeli/content';
import type { SupportedExerciseType } from '../app/learn/learn.models';

/** One small, valid payload per exercise type (shapes as in content/README.md). */
export const PAYLOADS: { readonly [K in SupportedExerciseType]: Payload<K> } = {
  'count-objects': {
    arrangement: 'line',
    objects: [
      { pictureId: 'apple', x: 0.1, y: 0.5 },
      { pictureId: 'apple', x: 0.3, y: 0.5 },
      { pictureId: 'apple', x: 0.5, y: 0.5 },
    ],
    answerMode: 'choices',
    choices: [
      { id: 'c2', value: 2 },
      { id: 'c3', value: 3 },
      { id: 'c4', value: 4 },
    ],
  },
  'number-recognition': {
    mode: 'match-quantity',
    representation: 'dots',
    choices: [
      { id: 'n2', value: 2, label: '2' },
      { id: 'n5', value: 5, label: '5' },
    ],
  },
  'ten-frame': {
    frame: 10,
    cells: [true, true, true, true, true, true, true, false, false, false],
    answerMode: 'keypad',
  },
  compare: { mode: 'quantities', left: { count: 3, pictureId: 'duck' }, right: { count: 5 } },
  'number-line': {
    mode: 'missing',
    start: 0,
    end: 10,
    step: 1,
    labels: [0, 1, 2, 4, 5, 6, 7, 8, 9, 10],
    markedTick: 3,
    choices: [
      { id: 'l3', value: 3 },
      { id: 'l4', value: 4 },
    ],
  },
  'add-sub': {
    op: 'sub',
    a: 7,
    b: 2,
    result: null,
    manipulatives: 'ten-frame',
    answerMode: 'keypad',
  },
  'number-bond': {
    whole: null,
    rows: [{ left: 3, right: 4 }],
    representation: 'numbers',
  },
  'number-wall': {
    rows: 2,
    cells: [
      { id: 'r0c0', row: 0, col: 0, value: 3 },
      { id: 'r0c1', row: 0, col: 1, value: null },
      { id: 'r1c0', row: 1, col: 0, value: null },
    ],
  },
  sequence: {
    kind: 'numbers',
    items: [2, 3, 4, null],
    answerMode: 'choices',
    choices: [
      { id: 's5', value: 5 },
      { id: 's6', value: 6 },
    ],
  },
  'shape-pick': {
    choices: [
      { id: 'circle', pictureId: 'shape-circle', scale: 1, rotation: 0 },
      { id: 'square', pictureId: 'shape-square', scale: 0.7, rotation: 45 },
    ],
  },
  'letter-sound': {
    choices: [
      { id: 'm', label: 'M' },
      { id: 'a', label: 'A' },
    ],
  },
  'initial-sound': {
    pictureId: 'mouse',
    choices: [
      { id: 'm', label: 'M' },
      { id: 's', label: 'S' },
    ],
  },
  syllables: { pictureId: 'banana', word: 'Banane', maxCount: 4 },
  'word-picture': {
    word: 'MAUS',
    syllables: ['MAUS'],
    choices: [
      { id: 'mouse', pictureId: 'mouse' },
      { id: 'egg', pictureId: 'egg' },
    ],
  },
  'build-word': {
    pictureId: 'egg',
    audio: true,
    length: 2,
    tiles: [
      { id: 't1', letter: 'i' },
      { id: 't2', letter: 'E' },
      { id: 't3', letter: 'x' },
    ],
  },
  'times-table': { mode: 'product', a: 3, b: 2, product: null, answerMode: 'keypad' },
  'division-share': {
    total: 6,
    groups: 3,
    pictureId: 'apple',
    answerMode: 'choices',
    choices: [
      { id: 'd1', value: 1 },
      { id: 'd2', value: 2 },
      { id: 'd3', value: 3 },
    ],
  },
  clock: {
    hour: 2,
    minute: 30,
    choices: [
      { id: 'k1', label: 'halb drei', digital: '2:30' },
      { id: 'k2', label: 'halb zwei', digital: '1:30' },
    ],
  },
  'money-chf': {
    mode: 'pay',
    currency: 'CHF',
    group: 'major',
    amount: 3,
    wallet: [
      { denomination: 'chf-1fr', label: '1 Fr.', kind: 'coin', file: 'money/chf-1fr.svg' },
      { denomination: 'chf-2fr', label: '2 Fr.', kind: 'coin', file: 'money/chf-2fr.svg' },
      { denomination: 'chf-10fr', label: '10 Fr.', kind: 'note', file: 'money/chf-10fr.svg' },
    ],
  },
  'trace-letter': {
    char: 'A',
    strokes: [
      [
        [50, 10],
        [20, 80],
      ],
      [
        [50, 10],
        [80, 80],
      ],
      [
        [31, 55],
        [69, 55],
      ],
    ],
    guides: { ascender: 10, xHeight: 45, baseline: 80, descender: 100 },
    showModel: true,
  },
  'listen-write': {
    length: 3,
    tiles: [
      { id: 't1', letter: 't' },
      { id: 't2', letter: 'a' },
      { id: 't3', letter: 'c' },
    ],
  },
  'sentence-picture': {
    sentence: 'Die Maus ist auf dem Bett.',
    choices: [
      { id: 's1', scene: { kind: 'position', subject: 'mouse', relation: 'on', object: 'bed' } },
      { id: 's2', scene: { kind: 'position', subject: 'mouse', relation: 'under', object: 'bed' } },
      { id: 's3', scene: { kind: 'count', pictureId: 'apple', count: 3 } },
    ],
  },
};

export function exercise<T extends SupportedExerciseType>(type: T, index = 0): PublicExercise {
  return {
    index,
    type,
    prompt: { text: `Aufgabe ${index + 1}`, speak: [`Aufgabe ${index + 1}`] },
    payload: PAYLOADS[type],
  } as PublicExercise;
}

export const DEMO: PublicDemo = {
  type: 'count-objects',
  prompt: { text: 'Wie viele Äpfel siehst du?', speak: ['Wie viele', 'Äpfel', 'siehst du?'] },
  payload: PAYLOADS['count-objects'],
  answer: { value: 3 },
  steps: [
    { say: 'Schau, hier sind Äpfel.', action: { highlight: 'objects' } },
    { say: 'Wir zählen.', action: { countAlong: true } },
    { say: 'Tippe auf die Drei!', action: { tapAnswer: true } },
  ],
};

export function run(overrides: Partial<StartRunResponse> = {}): StartRunResponse {
  return {
    runId: 'r1',
    items: [exercise('count-objects', 0), exercise('letter-sound', 1)],
    demoSeen: false,
    demo: DEMO,
    ...overrides,
  };
}
