import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  AnswerRequestSchema,
  checkAnswer,
  collectSpeakables,
  createRng,
  generateDemo,
  generateExercise,
  generateItem,
  generateRun,
  hashString,
  HINT_KEYS,
  HINTS,
  isPassed,
  itemScore,
  itemSeed,
  loadContent,
  mixSeed,
  parseAnswer,
  randomSeed,
  runScore,
  starsFor,
  toPublicDemo,
  toPublicExercise,
} from '../schema/index.ts';
import type { Payload } from '../schema/index.ts';
import { displayGrapheme, wordLetters } from '../schema/runtime/literacy.ts';
import { deepEqual, layout, numberChoices } from '../schema/runtime/helpers.ts';

const content = loadContent();
const options = { locale: 'de-CH' as const, content };

describe('rng', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = createRng(1);
    const b = createRng(1);
    const c = createRng(2);
    const first = [a.next(), a.next(), a.next()];
    assert.deepEqual(first, [b.next(), b.next(), b.next()]);
    assert.notDeepEqual(first, [c.next(), c.next(), c.next()]);
  });

  it('keeps ints in range and helpers pure', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: -5, max: 5 }),
        (seed, min) => {
          const rng = createRng(seed);
          const value = rng.int(min, min + 3);
          assert.ok(value >= min && value <= min + 3);
          const items = [1, 2, 3, 4, 5];
          const shuffled = rng.shuffle(items);
          assert.deepEqual(items, [1, 2, 3, 4, 5]);
          assert.deepEqual([...shuffled].sort(), items);
          const sample = rng.sample(items, 3);
          assert.equal(new Set(sample).size, 3);
          assert.equal(
            rng.weighted(['a', 'b'], (x) => (x === 'a' ? 0 : 1)),
            'b',
          );
          assert.match(rng.id(), /^[0-9a-z]{10}$/);
          assert.equal(typeof rng.bool(), 'boolean');
        },
      ),
    );
  });

  it('rejects impossible requests', () => {
    const rng = createRng(3);
    assert.throws(() => rng.int(2, 1), RangeError);
    assert.throws(() => rng.pick([]), RangeError);
    assert.throws(() => rng.sample([1], 2), RangeError);
    assert.throws(() => rng.weighted([1], () => 0), RangeError);
  });

  it('derives item seeds from run seed, level and index', () => {
    assert.equal(itemSeed(5, 'level-a', 0), itemSeed(5, 'level-a', 0));
    assert.notEqual(itemSeed(5, 'level-a', 0), itemSeed(5, 'level-a', 1));
    assert.notEqual(itemSeed(5, 'level-a', 0), itemSeed(5, 'level-b', 0));
    assert.notEqual(itemSeed(5, 'level-a', 0), itemSeed(6, 'level-a', 0));
    assert.equal(hashString('abc'), hashString('abc'));
    assert.ok(mixSeed(1, 2) >= 0 && mixSeed(1, 2) <= 0xffffffff);
    const seed = randomSeed();
    assert.ok(Number.isInteger(seed) && seed >= 0);
  });
});

describe('runs', () => {
  const level = content.index.levels['math-plusbruecke-05']!.level;

  it('generates level.items reproducible items with indices', () => {
    const run = generateRun(level, 1234, options);
    assert.equal(run.length, level.items);
    assert.deepEqual(
      run.map((item) => item.index),
      [...Array(level.items).keys()],
    );
    assert.deepEqual(generateRun(level, 1234, options), run);
    assert.notDeepEqual(generateRun(level, 1235, options), run);
    assert.deepEqual(generateItem(level, 1234, 3, options, run[2]), run[3]);
  });

  it('avoids repeating the same item back to back', () => {
    const tiny = content.index.levels['math-formenwald-01']!.level;
    const run = generateRun(tiny, 9, options, 20);
    const repeats = run
      .slice(1)
      .filter((item, i) => item.focus === run[i]!.focus).length;
    assert.ok(repeats < 10);
  });

  it('strips solutions from public exercises', () => {
    const [item] = generateRun(level, 1, options);
    const exercise = toPublicExercise(item!);
    assert.deepEqual(Object.keys(exercise).sort(), [
      'index',
      'payload',
      'prompt',
      'type',
    ]);
  });
});

describe('answers', () => {
  it('parses and rejects answers per type', () => {
    assert.ok(parseAnswer('add-sub', { value: 3 }).success);
    assert.equal(parseAnswer('add-sub', { value: -1 }).success, false);
    assert.equal(parseAnswer('add-sub', { value: 3, extra: 1 }).success, false);
    assert.ok(parseAnswer('sequence', { choiceId: 'abc' }).success);
    assert.ok(parseAnswer('number-wall', { values: { r1c0: 4 } }).success);
    assert.equal(
      parseAnswer('number-wall', { values: { x: 4 } }).success,
      false,
    );
    assert.ok(parseAnswer('compare', { relation: 'gt' }).success);
    assert.ok(parseAnswer('build-word', { letters: ['M', 'a'] }).success);
    assert.ok(parseAnswer('syllables', { count: 3 }).success);
  });

  it('checks with a hint on wrong answers', () => {
    const solution = {
      answer: { values: { r1c0: 4, r2c0: 9 } },
      hint: 'add-the-two-below' as const,
    };
    assert.deepEqual(checkAnswer(solution, { values: { r2c0: 9, r1c0: 4 } }), {
      correct: true,
    });
    assert.deepEqual(checkAnswer(solution, { values: { r1c0: 4 } }), {
      correct: false,
      hint: 'add-the-two-below',
    });
    assert.equal(checkAnswer(solution, null).correct, false);
  });

  it('validates answer requests', () => {
    assert.ok(
      AnswerRequestSchema.safeParse({ index: 0, answer: { value: 1 } }).success,
    );
    assert.equal(
      AnswerRequestSchema.safeParse({ index: -1, answer: {} }).success,
      false,
    );
  });
});

describe('demos', () => {
  it('are deterministic, honor targets and reveal the answer', () => {
    let targets = 0;
    for (const track of content.tracks) {
      for (const locale of track.locales) {
        for (const level of track.worlds.flatMap((w) => w.levels)) {
          const demo = generateDemo(level, locale, content);
          assert.deepEqual(generateDemo(level, locale, content), demo);
          assert.equal(demo.steps.length, level.demo.steps.length);
          assert.ok(demo.steps.every((step) => step.say.length > 0));
          if (level.demo.target !== undefined) {
            targets += 1;
            assert.equal(
              demo.exercise.focus,
              level.demo.target,
              `${level.id} ${locale}`,
            );
          }
          const pub = toPublicDemo(demo);
          assert.deepEqual(pub.answer, demo.exercise.solution.answer);
        }
      }
    }
    assert.ok(targets > 40);
  });

  it('keeps the given picture order when no target is set', () => {
    const level = content.index.levels['math-formenwald-05']!.level;
    const demo = generateDemo(level, 'en-US', content);
    const payload = demo.exercise.payload as Payload<'sequence'> & {
      kind: 'pattern';
    };
    assert.deepEqual(
      payload.items.slice(0, 2).map((i) => i.pictureId),
      ['apple', 'banana'],
    );
  });

  it('picks a picture for a letter target in initial-sound demos', () => {
    const g = generateExercise(
      {
        type: 'initial-sound',
        params: {
          letters: ['A', 'M'],
          distractors: [],
          choices: 2,
          display: 'upper',
        },
      },
      createRng(1),
      { locale: 'de-CH', content, demo: { target: 'M' } },
    );
    assert.equal(
      content.pictures[String(g.focus)]!.firstSound['de-CH']!.grapheme,
      'M',
    );
  });
});

describe('scoring', () => {
  it('scores items, runs and stars per the contract', () => {
    assert.equal(itemScore(true, 1), 1);
    assert.equal(itemScore(true, 2), 0.5);
    assert.equal(itemScore(true, 3), 0);
    assert.equal(itemScore(false, 1), 0);
    assert.equal(runScore([]), 0);
    assert.equal(runScore([1, 0.5, 0]), 0.5);
    assert.equal(starsFor(1, 0.8), 3);
    assert.equal(starsFor(0.85, 0.8), 2);
    assert.equal(starsFor(0.6, 0.8), 1);
    assert.equal(starsFor(0.2, 0.8), 0);
    assert.ok(isPassed(2) && !isPassed(1));
  });
});

describe('hints and helpers', () => {
  it('has kind hints in both locales that are speakable and use no sharp s', () => {
    const german = new Set(
      collectSpeakables(content, 'de-CH').map((s) => s.text),
    );
    for (const key of HINT_KEYS) {
      assert.ok(german.has(HINTS[key]['de-CH']));
      assert.ok(HINTS[key]['en-US'].length > 0);
      assert.equal(/[ßẞ]/u.test(HINTS[key]['de-CH']), false);
    }
  });

  it('formats letters and words', () => {
    assert.equal(displayGrapheme('Sch', 'lower', 'de-CH'), 'sch');
    assert.equal(displayGrapheme('M', 'pair', 'de-CH'), 'M m');
    assert.deepEqual(wordLetters('yo-yo'), ['y', 'o', 'y', 'o']);
  });

  it('fills up number choices when the range is small', () => {
    const choices = numberChoices(createRng(1), 0, 4, [0]);
    assert.equal(choices.length, 4);
    assert.ok(choices.some((c) => c.value === 0));
  });

  it('lays out objects inside the unit square', () => {
    const rng = createRng(4);
    for (const arrangement of [
      'line',
      'dice',
      'scattered',
      'ten-frame',
    ] as const) {
      const points = layout(arrangement, 6, rng);
      assert.equal(points.length, 6);
      assert.ok(
        points.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1),
      );
    }
    assert.equal(layout('dice', 9, rng).length, 9);
  });

  it('compares deeply', () => {
    assert.ok(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
    assert.equal(deepEqual([1], [1, 2]), false);
    assert.equal(deepEqual({ a: 1 }, { b: 1 }), false);
  });
});
