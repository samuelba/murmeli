import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  checkAnswer,
  collectSpeakables,
  createRng,
  generateExercise,
  loadContent,
  parseAnswer,
  range,
} from '../schema/index.ts';
import type {
  Choice,
  ExerciseSpec,
  GeneratedExercise,
  Locale,
  Payload,
} from '../schema/index.ts';

const content = loadContent();
const NUM_RUNS = 20;

interface Case {
  readonly name: string;
  readonly spec: ExerciseSpec;
  readonly locale: Locale;
}

const cases: Case[] = content.tracks.flatMap((track) =>
  track.locales.flatMap((locale) =>
    track.worlds.flatMap((world) =>
      world.levels.flatMap((level) =>
        level.generators.map((spec, i) => ({
          name: `${level.id}#${i} ${locale}`,
          spec,
          locale,
        })),
      ),
    ),
  ),
);

const speakables = {
  'de-CH': new Set(collectSpeakables(content, 'de-CH').map((s) => s.text)),
  'en-US': new Set(collectSpeakables(content, 'en-US').map((s) => s.text)),
};

function choicesOf(g: GeneratedExercise): readonly Choice[] | undefined {
  return (g.payload as { choices?: readonly Choice[] }).choices;
}

function wrongAnswer(g: GeneratedExercise): unknown {
  const answer = g.solution.answer as Record<string, unknown>;
  if ('choiceId' in answer) {
    return {
      choiceId: choicesOf(g)!.find((c) => c.id !== answer['choiceId'])!.id,
    };
  }
  if ('value' in answer) {
    return { value: (answer['value'] as number) + 1 };
  }
  if ('relation' in answer) {
    return { relation: answer['relation'] === 'eq' ? 'lt' : 'eq' };
  }
  if ('count' in answer) {
    const count = answer['count'] as number;
    return { count: count === 10 ? 9 : count + 1 };
  }
  if ('letters' in answer) {
    const letters = answer['letters'] as string[];
    return { letters: [...letters.slice(0, -1), `${letters.at(-1)}x`] };
  }
  const values = answer['values'];
  if (Array.isArray(values)) {
    return { values: [(values[0] as number) + 1, ...values.slice(1)] };
  }
  const record = values as Record<string, number>;
  const [first] = Object.keys(record);
  return { values: { ...record, [first!]: record[first!]! + 1 } };
}

function assertChoices(g: GeneratedExercise): void {
  const choices = choicesOf(g);
  if (choices === undefined) {
    return;
  }
  const distinct = (values: unknown[]) =>
    new Set(values).size === values.length;
  assert.ok(distinct(choices.map((c) => c.id)), 'choice ids are unique');
  assert.ok(
    choices.every((c) => /^[0-9a-z]{10}$/.test(c.id)),
    'choice ids look random',
  );
  for (const key of ['label', 'value', 'pictureId'] as const) {
    const values = choices.map((c) => c[key]).filter((v) => v !== undefined);
    assert.ok(distinct(values), `choice ${key}s are unique`);
  }
  const answer = g.solution.answer as { choiceId?: string; value?: number };
  const matches =
    answer.choiceId !== undefined
      ? choices.filter((c) => c.id === answer.choiceId)
      : choices.filter((c) => c.value === answer.value);
  assert.equal(matches.length, 1, 'the correct answer is offered exactly once');
}

type Checker = (
  g: GeneratedExercise,
  spec: ExerciseSpec,
  locale: Locale,
) => void;

const value = (g: GeneratedExercise) =>
  (g.solution.answer as { value: number }).value;

const RESPECTS: Partial<Record<ExerciseSpec['type'], Checker>> = {
  'count-objects': (g, spec) => {
    const p = spec.params as { min: number; max: number; objects: string[] };
    const payload = g.payload as Payload<'count-objects'>;
    assert.equal(payload.objects.length, value(g));
    assert.ok(value(g) >= p.min && value(g) <= p.max);
    assert.ok(payload.objects.every((o) => p.objects.includes(o.pictureId)));
    assert.ok(
      payload.objects.every(
        (o) => o.x >= 0 && o.x <= 1 && o.y >= 0 && o.y <= 1,
      ),
    );
  },
  'number-recognition': (g, spec) => {
    const p = spec.params as { min: number; max: number };
    assert.ok(value(g) >= p.min && value(g) <= p.max);
  },
  'ten-frame': (g, spec) => {
    const payload = g.payload as Payload<'ten-frame'>;
    assert.equal(
      payload.cells.length,
      (spec.params as { frame: number }).frame,
    );
    assert.equal(payload.cells.filter(Boolean).length, value(g));
  },
  compare: (g, spec) => {
    const p = spec.params as {
      min: number;
      max: number;
      allowEqual: boolean;
      maxDifference?: number;
    };
    const payload = g.payload as Payload<'compare'>;
    const a = payload.left.value ?? payload.left.count!;
    const b = payload.right.value ?? payload.right.count!;
    assert.ok(a >= p.min && a <= p.max && b >= p.min && b <= p.max);
    const relation = (g.solution.answer as { relation: string }).relation;
    assert.equal(relation, a < b ? 'lt' : a > b ? 'gt' : 'eq');
    if (!p.allowEqual) {
      assert.notEqual(a, b);
    }
    if (p.maxDifference !== undefined && a !== b) {
      assert.ok(Math.abs(a - b) <= p.maxDifference);
    }
  },
  'number-line': (g, spec) => {
    const p = spec.params as { start: number; end: number; step: number };
    assert.ok(range(p.start, p.end, p.step).includes(value(g)));
    const payload = g.payload as Payload<'number-line'>;
    if (payload.mode === 'missing') {
      assert.ok(!payload.labels.includes(value(g)));
    }
  },
  'add-sub': (g, spec) => {
    const p = spec.params as {
      max: number;
      crossTen: string;
      allowZero: boolean;
    };
    const payload = g.payload as Payload<'add-sub'>;
    const b = payload.b ?? value(g);
    const result = payload.result ?? value(g);
    assert.equal(payload.op === 'add' ? payload.a + b : payload.a - b, result);
    assert.ok(result <= p.max && payload.a <= p.max);
    const crosses =
      payload.op === 'add'
        ? (payload.a % 10) + (b % 10) >= 10
        : payload.a % 10 < b % 10;
    if (p.crossTen === 'never') {
      assert.equal(crosses, false);
    }
    if (p.crossTen === 'always') {
      assert.equal(crosses, true);
    }
    if (!p.allowZero) {
      assert.ok(payload.a > 0 && b > 0 && result > 0);
    }
  },
  'number-bond': (g, spec) => {
    const p = spec.params as { min: number; max: number; rows: number };
    const payload = g.payload as Payload<'number-bond'>;
    const values = [...(g.solution.answer as { values: number[] }).values];
    const whole = payload.whole ?? values.at(-1)!;
    assert.ok(whole >= p.min && whole <= p.max);
    assert.equal(payload.rows.length, p.rows);
    for (const row of payload.rows) {
      const left = row.left ?? values.shift()!;
      const right = row.right ?? values.shift()!;
      assert.equal(left + right, whole);
    }
  },
  'number-wall': (g, spec) => {
    const p = spec.params as { max: number };
    const payload = g.payload as Payload<'number-wall'>;
    const solved = (g.solution.answer as { values: Record<string, number> })
      .values;
    const at = (row: number, col: number) => {
      const cell = payload.cells.find((c) => c.row === row && c.col === col)!;
      return cell.value ?? solved[cell.id]!;
    };
    for (const cell of payload.cells.filter((c) => c.row > 0)) {
      assert.equal(
        at(cell.row, cell.col),
        at(cell.row - 1, cell.col) + at(cell.row - 1, cell.col + 1),
      );
    }
    assert.ok(at(payload.rows - 1, 0) <= p.max);
  },
  sequence: (g, spec) => {
    const payload = g.payload as Payload<'sequence'>;
    if (payload.kind === 'numbers') {
      const p = spec.params as { min: number; max: number; step: number };
      const items = payload.items.map((item) => item ?? value(g));
      const steps = items.slice(1).map((item, i) => Math.abs(item - items[i]!));
      assert.ok(steps.every((step) => step === p.step));
      assert.ok(items.every((item) => item >= p.min && item <= p.max));
    } else {
      assert.equal(
        payload.items.length,
        (spec.params as { shown: number }).shown,
      );
    }
  },
  'shape-pick': (g, spec) => {
    const p = spec.params as { shapes: string[]; choices: number };
    const payload = g.payload as Payload<'shape-pick'>;
    assert.equal(payload.choices.length, p.choices);
    assert.ok(payload.choices.every((c) => p.shapes.includes(c.pictureId)));
  },
  'initial-sound': (g, spec, locale) => {
    const payload = g.payload as Payload<'initial-sound'>;
    const sound = content.pictures[payload.pictureId]!.firstSound[locale]!;
    assert.ok(sound.regular);
    assert.ok(
      (spec.params as { letters: string[] }).letters.includes(sound.grapheme),
    );
  },
  syllables: (g, spec, locale) => {
    const payload = g.payload as Payload<'syllables'>;
    const count = (g.solution.answer as { count: number }).count;
    assert.equal(
      count,
      content.pictures[payload.pictureId]!.syllables[locale]!.length,
    );
    assert.ok(count <= (spec.params as { maxSyllables: number }).maxSyllables);
  },
  'build-word': (g, spec) => {
    const payload = g.payload as Payload<'build-word'>;
    const letters = (g.solution.answer as { letters: string[] }).letters;
    assert.equal(
      payload.tiles.length,
      payload.length + (spec.params as { extraTiles: number }).extraTiles,
    );
    const tiles = payload.tiles.map((t) => t.letter);
    for (const letter of letters) {
      const at = tiles.indexOf(letter);
      assert.ok(at >= 0, `tile ${letter} is available`);
      tiles.splice(at, 1);
    }
  },
};

describe('exercise runtime properties (real curriculum)', () => {
  assert.ok(cases.length > 200);
  for (const { name, spec, locale } of cases) {
    it(name, () => {
      const ctx = { locale, content };
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
          const g = generateExercise(spec, createRng(seed), ctx);
          assert.deepEqual(
            generateExercise(spec, createRng(seed), ctx),
            g,
            'deterministic',
          );
          assert.equal(g.type, spec.type);
          const answer = g.solution.answer;
          assert.ok(
            parseAnswer(g.type, answer).success,
            'solution matches the answer schema',
          );
          assert.deepEqual(checkAnswer(g.solution, answer), { correct: true });
          const wrong = checkAnswer(g.solution, wrongAnswer(g));
          assert.equal(wrong.correct, false);
          assert.equal(wrong.hint, g.solution.hint);
          assertChoices(g);
          RESPECTS[spec.type]?.(g, spec, locale);
          for (const segment of g.prompt.speak) {
            assert.ok(
              speakables[locale].has(segment),
              `"${segment}" is speakable`,
            );
          }
          const payload = JSON.stringify(g.payload);
          assert.ok(
            !/"(solution|answer|correct)"/.test(payload),
            'payload has no solution field',
          );
        }),
        { numRuns: NUM_RUNS, seed: 42 },
      );
    });
  }
});

describe('solutions do not leak through choice order', () => {
  it('puts the correct choice in different positions across seeds', () => {
    const positions = new Map<string, Set<number>>();
    for (const { spec, locale } of cases) {
      for (let seed = 0; seed < 30; seed += 1) {
        const g = generateExercise(spec, createRng(seed), { locale, content });
        const choices = choicesOf(g);
        const answer = g.solution.answer as {
          choiceId?: string;
          value?: number;
        };
        if (choices === undefined || choices.length < 2) {
          continue;
        }
        const index = choices.findIndex((c) =>
          answer.choiceId !== undefined
            ? c.id === answer.choiceId
            : c.value === answer.value,
        );
        const seen = positions.get(spec.type) ?? new Set<number>();
        seen.add(index);
        positions.set(spec.type, seen);
      }
    }
    assert.ok(positions.size >= 10);
    for (const [type, seen] of positions) {
      assert.ok(
        seen.size >= 2,
        `${type} varies the position of the correct choice`,
      );
    }
  });

  it('uses unrelated ids for choices of the same instance', () => {
    const g = generateExercise(
      {
        type: 'letter-sound',
        params: {
          letters: ['A', 'M', 'L', 'S'],
          distractors: [],
          choices: 4,
          display: 'upper',
        },
      },
      createRng(7),
      { locale: 'de-CH', content },
    );
    const ids = choicesOf(g)!.map((c) => c.id);
    assert.ok(ids.every((id) => !/^\d+$/.test(id)));
    assert.notDeepEqual(
      [...ids].sort(),
      ids.map((_, i) => String(i)),
    );
  });
});
