import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  checkAnswer,
  clockTimes,
  createRng,
  currencyFor,
  denominationsFor,
  digitalTime,
  generateExercise,
  GLYPH_CHARS,
  GLYPHS,
  greedyCoins,
  loadContent,
  parseExerciseParams,
  resample,
  sceneSentence,
  scoreTrace,
  sentenceScenes,
  timeWords,
} from '../schema/index.ts';
import type {
  ClockPayload,
  ExerciseSpec,
  GlyphPoint,
  Locale,
  SentencePictureParams,
} from '../schema/index.ts';

const content = loadContent();
type Stroke = [number, number][];

const model = (char: string): Stroke[] =>
  GLYPHS[char]!.strokes.map((stroke) =>
    stroke.points.map(([x, y]) => [x, y] as [number, number]),
  );

const strict = { tolerance: 1, strictOrder: true, strictDirection: true };
const lenient = { tolerance: 1, strictOrder: false, strictDirection: true };

function spec(type: string, params: unknown): ExerciseSpec {
  const parsed = parseExerciseParams(type, params, { minDistinct: 1 });
  assert.ok(parsed.success, JSON.stringify(parsed));
  return parsed.spec;
}

describe('glyph stroke data', () => {
  it('covers A-Z, a-z, umlauts and digits with sane strokes', () => {
    assert.equal(GLYPH_CHARS.length, 26 + 26 + 6 + 10);
    for (const char of GLYPH_CHARS) {
      const strokes = GLYPHS[char]!.strokes;
      assert.ok(strokes.length >= 1 && strokes.length <= 6, char);
      for (const stroke of strokes) {
        assert.ok(stroke.points.length >= 2, char);
        assert.ok(
          stroke.points.every(
            ([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100,
          ),
          char,
        );
      }
    }
  });
});

describe('trace checker', () => {
  it('accepts the model strokes for every glyph', () => {
    for (const char of GLYPH_CHARS) {
      assert.deepEqual(
        scoreTrace(char, model(char), strict).correct,
        true,
        char,
      );
    }
  });

  it('accepts wobbly, shifted and resampled tracing', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GLYPH_CHARS),
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 12, max: 120 }),
        (char, seed, points) => {
          const rng = createRng(seed);
          const dx = (rng.next() - 0.5) * 8;
          const dy = (rng.next() - 0.5) * 8;
          const drawn = model(char).map((stroke) =>
            resample(stroke, points).map(
              ([x, y]) =>
                [
                  x + dx + (rng.next() - 0.5) * 6,
                  y + dy + (rng.next() - 0.5) * 6,
                ] as [number, number],
            ),
          );
          assert.equal(scoreTrace(char, drawn, lenient).correct, true, char);
        },
      ),
      { numRuns: 300, seed: 7 },
    );
  });

  it('rejects scribbles', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('A', 'O', 'm', 'S', '8', 'k'),
        fc.integer({ min: 0, max: 0xffffffff }),
        (char, seed) => {
          const rng = createRng(seed);
          const drawn = model(char).map(() =>
            Array.from(
              { length: 6 },
              () => [rng.int(0, 100), rng.int(0, 100)] as [number, number],
            ),
          );
          const result = scoreTrace(char, drawn, lenient);
          assert.equal(result.correct, false);
          assert.equal(result.hint, 'trace-slowly');
        },
      ),
      { numRuns: 200, seed: 11 },
    );
  });

  it('rejects another letter with the same stroke count', () => {
    assert.equal(scoreTrace('L', model('V'), lenient).correct, false);
    assert.equal(scoreTrace('Z', model('N'), lenient).correct, false);
  });

  it('gives a direction hint for a reversed stroke', () => {
    const drawn = model('L').map((stroke) => [...stroke].reverse());
    assert.deepEqual(
      {
        correct: scoreTrace('L', drawn, strict).correct,
        hint: scoreTrace('L', drawn, strict).hint,
      },
      { correct: false, hint: 'start-at-dot' },
    );
    assert.equal(
      scoreTrace('L', drawn, { ...strict, strictDirection: false }).correct,
      true,
    );
  });

  it('handles stroke order and stroke count', () => {
    const swapped = [...model('T')].reverse();
    assert.equal(scoreTrace('T', swapped, lenient).correct, true);
    assert.equal(scoreTrace('T', swapped, strict).hint, 'stroke-order');
    assert.equal(
      scoreTrace('T', model('T').slice(0, 1), strict).hint,
      'stroke-count',
    );
  });

  it('treats i-dots as taps', () => {
    const [stem] = model('i');
    assert.equal(scoreTrace('i', [stem!, [[50, 30]]], strict).correct, true);
    assert.equal(
      scoreTrace(
        'i',
        [
          stem!,
          [
            [50, 30],
            [50, 60],
          ],
        ],
        strict,
      ).correct,
      false,
    );
  });

  it('is tolerant for small hands only as far as the tolerance allows', () => {
    const shifted = model('l').map((stroke) =>
      stroke.map(([x, y]) => [x + 14, y] as [number, number]),
    );
    assert.equal(scoreTrace('l', shifted, strict).correct, false);
    assert.equal(
      scoreTrace('l', shifted, { ...strict, tolerance: 1.5 }).correct,
      true,
    );
  });

  it('resamples evenly, also degenerate strokes', () => {
    const points = resample(
      [
        [0, 0],
        [10, 0],
      ],
      3,
    );
    assert.deepEqual(points, [
      [0, 0],
      [5, 0],
      [10, 0],
    ]);
    assert.equal(resample([[4, 4]] as GlyphPoint[], 5).length, 5);
    assert.throws(() => scoreTrace('$', [], strict), /no stroke data/);
  });

  it('checks trace answers through checkAnswer', () => {
    const g = generateExercise(
      spec('trace-letter', { letters: ['E'] }),
      createRng(1),
      {
        locale: 'de-CH',
        content,
      },
    );
    assert.deepEqual(checkAnswer(g.solution, g.solution.answer), {
      correct: true,
    });
    assert.deepEqual(checkAnswer(g.solution, { strokes: [[[0, 0]]] }), {
      correct: false,
      hint: 'stroke-count',
    });
    assert.deepEqual(checkAnswer(g.solution, { value: 1 }), {
      correct: false,
      hint: 'trace-slowly',
    });
  });
});

describe('money', () => {
  it('uses the currency of the locale for auto', () => {
    assert.equal(currencyFor('auto', 'de-CH'), 'CHF');
    assert.equal(currencyFor('auto', 'en-US'), 'USD');
    assert.equal(currencyFor('CHF', 'en-US'), 'CHF');
  });

  it('accepts any coins that add up to the amount', () => {
    const g = generateExercise(
      spec('money-chf', { mode: 'pay', maxTotal: 8 }),
      createRng(2),
      {
        locale: 'de-CH',
        content,
        demo: { target: 8 },
      },
    );
    assert.equal(g.focus, 8);
    assert.deepEqual(
      checkAnswer(g.solution, { coins: ['chf-5fr', 'chf-2fr', 'chf-1fr'] }),
      { correct: true },
    );
    assert.deepEqual(
      checkAnswer(g.solution, { coins: Array(8).fill('chf-1fr') }),
      { correct: true },
    );
    assert.equal(
      checkAnswer(g.solution, { coins: ['chf-5fr', 'chf-2fr'] }).correct,
      false,
    );
    assert.equal(
      checkAnswer(g.solution, { coins: ['usd-5', 'chf-2fr', 'chf-1fr'] })
        .correct,
      false,
    );
    assert.equal(checkAnswer(g.solution, { value: 8 }).correct, false);
  });

  it('pays greedily for the revealed solution', () => {
    assert.deepEqual(greedyCoins(85, denominationsFor('CHF', 'minor')), [
      'chf-50rp',
      'chf-20rp',
      'chf-10rp',
      'chf-5rp',
    ]);
    assert.deepEqual(greedyCoins(41, denominationsFor('USD', 'minor')), [
      'usd-25c',
      'usd-10c',
      'usd-5c',
      'usd-1c',
    ]);
  });

  it('hits a demo target total in both currencies', () => {
    for (const locale of ['de-CH', 'en-US'] as Locale[]) {
      const g = generateExercise(
        spec('money-chf', {
          mode: 'total',
          maxTotal: 3,
          minItems: 2,
          maxItems: 3,
        }),
        createRng(3),
        { locale, content, demo: { target: 3 } },
      );
      assert.equal(g.focus, 3);
    }
  });
});

describe('clock phrasing', () => {
  it('uses Swiss German and American phrasing', () => {
    const say = (hour: number, minute: number, locale: Locale) =>
      timeWords({ hour, minute }, locale);
    assert.equal(say(2, 30, 'de-CH'), 'halb drei');
    assert.equal(say(3, 15, 'de-CH'), 'Viertel nach drei');
    assert.equal(say(2, 45, 'de-CH'), 'Viertel vor drei');
    assert.equal(say(1, 0, 'de-CH'), 'ein Uhr');
    assert.equal(say(12, 30, 'de-CH'), 'halb eins');
    assert.equal(say(3, 25, 'de-CH'), 'fünf vor halb vier');
    assert.equal(say(2, 30, 'en-US'), 'half past two');
    assert.equal(say(2, 45, 'en-US'), 'quarter to three');
    assert.equal(say(12, 50, 'en-US'), 'ten to one');
    assert.equal(digitalTime({ hour: 9, minute: 5 }), '9:05');
  });

  it('lists times per step', () => {
    assert.deepEqual(
      (['hour', 'half', 'quarter', 'five'] as const).map(
        (step) => clockTimes(step).length,
      ),
      [12, 24, 48, 144],
    );
  });

  it('offers the right time exactly once with confusable distractors', () => {
    const g = generateExercise(
      spec('clock', { steps: 'half', choices: 3 }),
      createRng(5),
      {
        locale: 'de-CH',
        content,
        demo: { target: '2:30' },
      },
    );
    const payload = g.payload as ClockPayload;
    assert.deepEqual([payload.hour, payload.minute], [2, 30]);
    assert.equal(
      payload.choices.filter((c) => c.label === 'halb drei').length,
      1,
    );
  });
});

describe('sentences', () => {
  it('builds German and English sentences with the right articles', () => {
    const scene = {
      kind: 'position',
      subject: 'cat',
      relation: 'under',
      object: 'umbrella',
    } as const;
    assert.equal(
      sceneSentence(scene, content.pictures, 'de-CH'),
      'Die Katze ist unter dem Schirm.',
    );
    assert.equal(
      sceneSentence(scene, content.pictures, 'en-US'),
      'The cat is under the umbrella.',
    );
    assert.equal(
      sceneSentence(
        { kind: 'count', pictureId: 'egg', count: 4 },
        content.pictures,
        'de-CH',
      ),
      'Ich sehe vier Eier.',
    );
    assert.equal(
      sceneSentence(
        { kind: 'count', pictureId: 'nose', count: 2 },
        content.pictures,
        'en-US',
      ),
      undefined,
    );
    assert.equal(
      sceneSentence(
        { kind: 'position', subject: 'nope', relation: 'on', object: 'bed' },
        content.pictures,
        'en-US',
      ),
      undefined,
    );
  });

  it('enumerates distinct scenes without self-relations', () => {
    const params = {
      kind: 'position',
      subjects: ['cat', 'bed'],
      objects: ['bed'],
      relations: ['on', 'under'],
      choices: 2,
    } as SentencePictureParams;
    assert.equal(sentenceScenes(params).length, 2);
  });
});
