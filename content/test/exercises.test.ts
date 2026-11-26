import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bondCount,
  crossesTen,
  enumerateAddSub,
  EXERCISE_PARAMS_SCHEMAS,
  EXERCISE_TYPE_IDS,
  EXERCISE_TYPES,
  exerciseTypeDef,
  isExerciseTypeId,
  parseExerciseParams,
} from '../schema/index.ts';
import type { ExerciseTypeId } from '../schema/index.ts';
import { AddSubParamsSchema } from '../schema/exercises/math.ts';

const VALID: Record<ExerciseTypeId, unknown> = {
  'count-objects': { min: 1, max: 5, objects: ['apple'] },
  'number-recognition': { min: 1, max: 10 },
  'ten-frame': { min: 1, max: 10 },
  compare: { min: 0, max: 10 },
  'number-line': { start: 0, end: 10 },
  'add-sub': { operations: ['add'], max: 10 },
  'number-bond': { min: 4, max: 10 },
  'number-wall': { max: 20 },
  sequence: { kind: 'numbers', min: 0, max: 10 },
  'shape-pick': { shapes: ['shape-circle', 'shape-square', 'shape-triangle'] },
  'letter-sound': { letters: ['A', 'M', 'L'] },
  'initial-sound': { letters: ['A', 'M'], distractors: ['L'] },
  syllables: { pictures: ['apple', 'mouse'] },
  'word-picture': { words: ['apple', 'mouse', 'cat'] },
  'build-word': { words: ['mouse'] },
  'times-table': { rows: [2, 5, 10] },
  'division-share': { divisors: [2, 3], objects: ['apple'] },
  clock: { steps: 'half' },
  'money-chf': { mode: 'total', maxTotal: 10 },
  'trace-letter': { letters: ['A', 'm', '3'] },
  'listen-write': { words: ['mouse'] },
  'sentence-picture': {
    kind: 'position',
    subjects: ['mouse', 'cat'],
    objects: ['bed'],
  },
};

const INVALID: [ExerciseTypeId, unknown, RegExp][] = [
  [
    'count-objects',
    { min: 5, max: 2, objects: ['apple'] },
    /min must not exceed max/,
  ],
  [
    'count-objects',
    { min: 1, max: 8, objects: ['apple'], arrangement: 'dice' },
    /dice/,
  ],
  ['count-objects', { min: 1, max: 5, objects: [] }, /params\.objects/],
  [
    'count-objects',
    { min: 1, max: 5, objects: ['apple'], extra: 1 },
    /Unrecognized/,
  ],
  ['number-recognition', { min: 1, max: 2, choices: 3 }, /at least 3 numbers/],
  [
    'number-recognition',
    { min: 1, max: 15, mode: 'match-quantity' },
    /at most 10/,
  ],
  [
    'number-recognition',
    { min: 1, max: 5, mode: 'match-quantity', representation: 'objects' },
    /needs objects/,
  ],
  ['ten-frame', { min: 1, max: 15 }, /10-frame holds/],
  ['ten-frame', { min: 1, max: 10, frame: 12 }, /params\.frame/],
  ['compare', { min: 5, max: 5 }, /smaller than max/],
  ['compare', { mode: 'quantities', min: 1, max: 15 }, /at most 10/],
  ['number-line', { start: 10, end: 5 }, /larger than start/],
  ['number-line', { start: 0, end: 9, step: 2 }, /multiple of step/],
  ['number-line', { start: 0, end: 100, step: 1 }, /between 4 and 20/],
  ['add-sub', { operations: ['add'], max: 2 }, /only 1 distinct/],
  [
    'add-sub',
    {
      operations: ['add', 'sub'],
      max: 10,
      a: { min: 1, max: 3 },
      b: { min: 5, max: 9 },
    },
    /no subtraction/,
  ],
  [
    'add-sub',
    { operations: ['add'], max: 20, manipulatives: 'ten-frame' },
    /at most 10/,
  ],
  [
    'add-sub',
    { operations: ['add'], max: 10, manipulatives: 'objects' },
    /need objects/,
  ],
  [
    'add-sub',
    { operations: ['sub'], max: 10, unknown: 'operand' },
    /only supported for addition/,
  ],
  [
    'add-sub',
    { operations: ['add'], max: 10, a: { min: 5, max: 2 } },
    /params\.a\.min/,
  ],
  [
    'add-sub',
    { operations: ['add'], max: 10, b: { min: 5, max: 2 } },
    /params\.b\.min/,
  ],
  ['number-bond', { min: 3, max: 10, rows: 3 }, /only 2 different splits/],
  ['number-bond', { min: 2, max: 12, representation: 'dots' }, /at most 10/],
  ['number-wall', { rows: 2, max: 10, blanks: 2 }, /only have 1 blank/],
  ['number-wall', { rows: 3, max: 5 }, /at least 6/],
  [
    'sequence',
    { kind: 'numbers', min: 0, max: 5, step: 2, length: 4 },
    /does not fit/,
  ],
  [
    'sequence',
    { kind: 'pattern', pictures: ['apple', 'mouse'], unit: 'ABC' },
    /needs 3 pictures/,
  ],
  [
    'sequence',
    { kind: 'pattern', pictures: ['apple', 'mouse'], choices: 3 },
    /choices exceed/,
  ],
  ['sequence', { kind: 'other' }, /params\.kind/],
  [
    'shape-pick',
    { shapes: ['shape-circle', 'shape-square'], choices: 3 },
    /choices exceed/,
  ],
  ['letter-sound', { letters: ['A'], choices: 3 }, /only 1 given/],
  ['letter-sound', { letters: ['sch'] }, /capitalized/],
  ['initial-sound', { letters: ['A', 'M'], choices: 3 }, /only 2 given/],
  ['syllables', { pictures: ['apple'] }, /params\.pictures/],
  ['word-picture', { words: ['apple', 'mouse'], choices: 3 }, /choices exceed/],
  ['build-word', { words: ['mouse'], extraTiles: 9 }, /params\.extraTiles/],
  [
    'times-table',
    { rows: [2], minFactor: 5, maxFactor: 3 },
    /minFactor must not exceed/,
  ],
  [
    'times-table',
    { rows: [2], mode: 'row', minFactor: 1, maxFactor: 3 },
    /at least 4 factors/,
  ],
  [
    'times-table',
    { rows: [2], mode: 'missing-factor', minFactor: 0 },
    /product is 0/,
  ],
  ['times-table', { rows: [11] }, /params\.rows/],
  [
    'division-share',
    { divisors: [2], objects: ['apple'], minQuotient: 6, maxQuotient: 2 },
    /minQuotient/,
  ],
  ['division-share', { divisors: [1], objects: ['apple'] }, /params\.divisors/],
  ['clock', { steps: 'minute' }, /params\.steps/],
  [
    'money-chf',
    { mode: 'total', minItems: 5, maxItems: 2, maxTotal: 10 },
    /minItems must not exceed/,
  ],
  [
    'money-chf',
    { mode: 'total', group: 'minor', minItems: 3, maxTotal: 10 },
    /CHF needs a larger maxTotal/,
  ],
  ['money-chf', { mode: 'pay', maxTotal: 1 }, /params\.maxTotal/],
  ['trace-letter', { letters: ['$'] }, /no stroke data/],
  ['trace-letter', { letters: ['A'], tolerance: 9 }, /params\.tolerance/],
  ['listen-write', { words: ['mouse'], maxLength: 9 }, /params\.maxLength/],
  [
    'sentence-picture',
    { kind: 'position', subjects: ['cat'], objects: ['cat'] },
    /only 0 different/,
  ],
  [
    'sentence-picture',
    { kind: 'count', pictures: ['apple'], min: 4, max: 3 },
    /min must not exceed max/,
  ],
];

describe('exercise type registry', () => {
  it('has all exercise types with schemas, frames and descriptions', () => {
    assert.equal(EXERCISE_TYPE_IDS.length, 22);
    for (const id of EXERCISE_TYPE_IDS) {
      assert.equal(EXERCISE_TYPES[id].id, id);
      assert.equal(
        EXERCISE_PARAMS_SCHEMAS[id],
        EXERCISE_TYPES[id].paramsSchema,
      );
      assert.ok(Object.keys(EXERCISE_TYPES[id].frames).length > 0);
      assert.ok(EXERCISE_TYPES[id].description.length > 0);
    }
    assert.ok(isExerciseTypeId('add-sub'));
    assert.equal(isExerciseTypeId('toString'), false);
  });

  for (const id of EXERCISE_TYPE_IDS) {
    it(`accepts valid ${id} params`, () => {
      const result = parseExerciseParams(id, VALID[id]);
      assert.ok(result.success, JSON.stringify(result));
      assert.equal(result.spec.type, id);
    });
  }

  for (const [id, params, pattern] of INVALID) {
    it(`rejects ${id} ${JSON.stringify(params)}`, () => {
      const result = parseExerciseParams(id, params);
      assert.equal(result.success, false);
      const text = result.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      assert.match(text, pattern);
    });
  }

  it('rejects unknown types', () => {
    const result = parseExerciseParams('juggling', {});
    assert.equal(result.success, false);
    assert.match(result.issues[0]!.message, /unknown exercise type/);
  });

  it('allows single-instance params for demos', () => {
    const params = {
      operations: ['add'],
      max: 10,
      a: { min: 2, max: 2 },
      b: { min: 1, max: 1 },
    };
    assert.equal(parseExerciseParams('add-sub', params).success, false);
    assert.ok(
      parseExerciseParams('add-sub', params, { minDistinct: 1 }).success,
    );
    assert.ok(
      parseExerciseParams('compare', { min: 4, max: 4 }, { minDistinct: 1 })
        .success,
    );
  });

  it('applies defaults', () => {
    const result = parseExerciseParams('count-objects', {
      min: 1,
      max: 3,
      objects: ['apple'],
    });
    assert.ok(result.success);
    assert.deepEqual(result.spec.params, {
      min: 1,
      max: 3,
      objects: ['apple'],
      arrangement: 'scattered',
      choices: 3,
      answerMode: 'choices',
    });
  });
});

describe('add-sub enumeration', () => {
  const parse = (raw: unknown) => AddSubParamsSchema.parse(raw);

  it('detects crossing ten', () => {
    assert.ok(crossesTen('add', 8, 5));
    assert.equal(crossesTen('add', 12, 5), false);
    assert.ok(crossesTen('sub', 13, 5));
    assert.equal(crossesTen('sub', 18, 5), false);
  });

  it('respects crossTen, ranges and multiples', () => {
    const always = enumerateAddSub(
      parse({ operations: ['add'], max: 20, crossTen: 'always' }),
    );
    assert.ok(
      always.length > 0 &&
        always.every((p) => crossesTen('add', p.a, p.b) && p.result <= 20),
    );
    const never = enumerateAddSub(
      parse({ operations: ['sub'], max: 20, crossTen: 'never' }),
    );
    assert.ok(
      never.every((p) => !crossesTen('sub', p.a, p.b) && p.result >= 1),
    );
    const tens = enumerateAddSub(
      parse({
        operations: ['add'],
        max: 100,
        aMultipleOf: 10,
        bMultipleOf: 10,
      }),
    );
    assert.ok(tens.every((p) => p.a % 10 === 0 && p.b % 10 === 0));
    const zero = enumerateAddSub(
      parse({ operations: ['sub'], max: 3, allowZero: true }),
    );
    assert.ok(zero.some((p) => p.result === 0 || p.b === 0));
  });

  it('counts number bonds', () => {
    assert.equal(bondCount(5, false), 4);
    assert.equal(bondCount(5, true), 6);
    assert.equal(bondCount(1, false), 0);
  });

  it('lists frame slot values for every type', () => {
    const ctx = { locale: 'de-CH' as const, pictures: {} };
    for (const id of EXERCISE_TYPE_IDS) {
      const result = parseExerciseParams(id, VALID[id]);
      assert.ok(result.success);
      const uses = exerciseTypeDef(id).frameUses(result.spec.params, ctx);
      assert.ok(uses.length > 0);
    }
  });
});
