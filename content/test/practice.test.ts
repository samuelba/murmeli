import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  answerText,
  demoFits,
  exerciseKey,
  generateExercise,
  generatePracticeItem,
  isPracticeTopicId,
  loadContent,
  narrowSpec,
  PRACTICE_TOPIC_IDS,
  PRACTICE_TOPIC_TITLES,
  practiceDemoLevel,
  practiceLadders,
  regenerateExercise,
  spokenQuestion,
  topicOfExercise,
  topicsOfSpec,
  createRng,
  collectSpeakables,
} from '../schema/index.ts';
import type {
  ExerciseSpec,
  GeneratedItem,
  PracticeTopicId,
} from '../schema/index.ts';

const content = loadContent();
const options = { locale: 'de-CH' as const, content };
const tracksFor = (locale: 'de-CH' | 'en-US') =>
  content.tracks.filter((track) => track.locales.includes(locale));

function spec(raw: unknown): ExerciseSpec {
  return raw as ExerciseSpec;
}

function addParams() {
  return {
    max: 10,
    aMultipleOf: 1,
    bMultipleOf: 1,
    crossTen: 'allowed',
    allowZero: false,
    unknown: 'result',
    manipulatives: 'none',
    answerMode: 'choices',
    choices: 3,
  };
}

describe('practice topics', () => {
  it('has a title in every locale without ß', () => {
    for (const id of PRACTICE_TOPIC_IDS) {
      const title = PRACTICE_TOPIC_TITLES[id];
      assert.ok(title['de-CH'] && title['en-US'], id);
      assert.ok(!title['de-CH'].includes('ß'), id);
    }
    assert.ok(isPracticeTopicId('plus'));
    assert.equal(isPracticeTopicId('flying'), false);
  });

  it('splits mixed plus and minus generators', () => {
    const mixed = content.index.levels[
      'math-rechenberg-06'
    ]!.level.generators.map((generator) => generator as ExerciseSpec).find(
      (generator) =>
        generator.type === 'add-sub' &&
        generator.params.operations.length === 2,
    )!;
    const plus = narrowSpec(mixed, 'plus');
    const minus = narrowSpec(mixed, 'minus');
    assert.deepEqual(plus?.type === 'add-sub' && plus.params.operations, [
      'add',
    ]);
    assert.deepEqual(minus?.type === 'add-sub' && minus.params.operations, [
      'sub',
    ]);
    assert.equal(narrowSpec(mixed, 'count'), null);
    assert.deepEqual(topicsOfSpec(mixed), ['plus', 'minus']);
  });

  it('keeps a spec that needs no narrowing as the same object', () => {
    const add = spec({
      type: 'add-sub',
      params: { ...addParams(), operations: ['add'] },
    });
    assert.equal(narrowSpec(add, 'plus'), add);
    assert.equal(narrowSpec(add, 'minus'), null);
  });

  it('drops a narrowed part that allows no problem', () => {
    const narrowOnly = spec({
      type: 'add-sub',
      params: {
        ...addParams(),
        operations: ['add', 'sub'],
        max: 5,
        a: { min: 0, max: 0 },
        b: { min: 1, max: 5 },
      },
    });
    assert.equal(narrowSpec(narrowOnly, 'minus'), null);
  });

  it('tells number sequences from picture patterns', () => {
    const numbers = content.index.levels['math-zahlenbach-04']!.level
      .generators[0] as ExerciseSpec;
    const pattern = content.index.levels['math-formenwald-05']!.level
      .generators[0] as ExerciseSpec;
    assert.deepEqual(topicsOfSpec(numbers), ['sequence']);
    assert.deepEqual(topicsOfSpec(pattern), ['patterns']);
    assert.equal(narrowSpec(numbers, 'plus'), null);
    assert.equal(narrowSpec(numbers, 'patterns'), null);
  });

  it('puts every generated exercise into a topic its generator trains', () => {
    for (const track of content.tracks) {
      const locale = track.locales[0]!;
      for (const world of track.worlds) {
        for (const level of world.levels) {
          level.generators.forEach((generator, index) => {
            const exercise = generateExercise(generator, createRng(index), {
              locale,
              content,
            });
            assert.ok(
              topicsOfSpec(generator).includes(topicOfExercise(exercise)),
              `${level.id}#${index}`,
            );
          });
        }
      }
    }
  });
});

describe('practice ladders', () => {
  it('orders steps along the trail and covers every topic once', () => {
    const ladders = practiceLadders(tracksFor('de-CH'));
    const topics = ladders.map((ladder) => ladder.topic);
    assert.equal(new Set(topics).size, topics.length);
    const plus = ladders.find((ladder) => ladder.topic === 'plus')!;
    assert.equal(plus.trackId, 'math');
    assert.equal(plus.steps[0]!.level.id, 'math-plusbruecke-01');
    assert.deepEqual(
      plus.steps.map((step) => step.index),
      [...plus.steps.keys()],
    );
    for (const step of plus.steps) {
      for (const source of step.specs) {
        assert.ok(
          source.spec.type === 'add-sub' &&
            source.spec.params.operations.every((op) => op === 'add'),
        );
      }
    }
  });

  it('only offers the literacy topics of the kid language', () => {
    const de = practiceLadders(tracksFor('de-CH'));
    const en = practiceLadders(tracksFor('en-US'));
    assert.equal(
      de.find((l) => l.topic === 'syllables')?.trackId,
      'reading-de',
    );
    assert.equal(
      en.find((l) => l.topic === 'syllables')?.trackId,
      'reading-en',
    );
  });

  it('finds a fitting demo for every topic', () => {
    for (const locale of ['de-CH', 'en-US'] as const) {
      for (const ladder of practiceLadders(tracksFor(locale))) {
        const last = ladder.steps.length - 1;
        for (const step of [0, last]) {
          const level = practiceDemoLevel(ladder, step);
          assert.ok(level, `${locale} ${ladder.topic}`);
          assert.ok(demoFits(level, ladder.topic));
        }
      }
    }
  });

  it('prefers the nearest demo at or below the step', () => {
    const plus = practiceLadders(tracksFor('de-CH')).find(
      (ladder) => ladder.topic === 'plus',
    )!;
    assert.equal(practiceDemoLevel(plus, 0)?.id, 'math-plusbruecke-01');
    assert.equal(practiceDemoLevel(plus, 2)?.id, plus.steps[2]!.level.id);
  });

  it('generates varied, reproducible practice items that can be made again', () => {
    const ladder = practiceLadders(tracksFor('de-CH')).find(
      (l) => l.topic === 'minus',
    )!;
    const step = ladder.steps.find((s) =>
      s.level.generators.some(
        (g) => g.type === 'add-sub' && g.params.operations.length === 2,
      ),
    )!;
    const items: GeneratedItem[] = [];
    for (let index = 0; index < 8; index += 1) {
      items.push(generatePracticeItem(ladder, step, 42, index, options, items));
    }
    assert.equal(new Set(items.map((item) => item.key)).size, items.length);
    for (const item of items) {
      assert.equal(topicOfExercise(item), 'minus');
      assert.equal(item.source.topic, 'minus');
      const again = regenerateExercise(
        content.index.levels,
        item.source,
        options,
      );
      assert.equal(again && exerciseKey(again), item.key);
    }
    assert.deepEqual(
      generatePracticeItem(ladder, step, 42, 0, options),
      items[0],
    );
  });

  it('cannot make an item again once its level or topic is gone', () => {
    const source = { levelId: 'math-plusbruecke-01', generator: 0, seed: 1 };
    assert.ok(regenerateExercise(content.index.levels, source, options));
    for (const broken of [
      { ...source, levelId: 'gone' },
      { ...source, generator: 99 },
      { ...source, topic: 'minus' as PracticeTopicId },
    ]) {
      assert.equal(
        regenerateExercise(content.index.levels, broken, options),
        undefined,
      );
    }
  });

  it('lists the topic titles as speakables', () => {
    const texts = new Set(
      collectSpeakables(content, 'de-CH').map((speakable) => speakable.text),
    );
    assert.ok(texts.has('Plus rechnen'));
    assert.ok(texts.has('Silben'));
  });
});

describe('exercise keys', () => {
  it('give the same key only to the same question with the same answer', () => {
    for (const track of content.tracks) {
      for (const locale of track.locales) {
        const ctx = { locale, content };
        for (const world of track.worlds) {
          for (const level of world.levels) {
            level.generators.forEach((generator, index) => {
              const seen = new Map<string, string>();
              for (let seed = 0; seed < 40; seed += 1) {
                const exercise = generateExercise(
                  generator,
                  createRng(seed * 7919 + index),
                  ctx,
                );
                const meaning = JSON.stringify([
                  exercise.focus,
                  answerText(exercise, content.pictures, locale) ??
                    exercise.prompt.speak,
                ]);
                const key = exerciseKey(exercise);
                const earlier = seen.get(key);
                assert.ok(
                  earlier === undefined || earlier === meaning,
                  `${level.id}#${index} ${locale}: ${earlier} vs ${meaning}`,
                );
                seen.set(key, meaning);
              }
            });
          }
        }
      }
    }
  });
});

describe('mistake descriptions', () => {
  it('joins spoken segments into sentences', () => {
    assert.equal(
      spokenQuestion(['Hör gut zu:', 'Hund', 'Wie viele Silben hörst du?']),
      'Hör gut zu: Hund. Wie viele Silben hörst du?',
    );
    assert.equal(
      spokenQuestion(['Wie viel fehlt von', '7', 'bis', '9']),
      'Wie viel fehlt von 7 bis 9',
    );
    assert.equal(spokenQuestion([' ', 'A']), 'A');
  });

  it('writes the right answer for each answer shape', () => {
    const at = (answer: unknown, payload: unknown = {}) =>
      answerText(
        { payload, solution: { answer, hint: 'count-on' } } as never,
        content.pictures,
        'de-CH',
      );
    assert.equal(at({ value: 7 }), '7');
    assert.equal(at({ count: 2 }), '2');
    assert.equal(at({ values: [3, 4] }), '3, 4');
    assert.equal(at({ values: { r1c0: 5, r2c0: 9 } }), '5, 9');
    assert.equal(at({ letters: ['M', 'o', 'n', 'd'] }), 'Mond');
    assert.equal(at({ relation: 'lt' }), '<');
    assert.equal(
      at(
        { choiceId: 'b' },
        { choices: [{ id: 'a' }, { id: 'b', label: '3 Uhr' }] },
      ),
      '3 Uhr',
    );
    assert.equal(
      at({ choiceId: 'b' }, { choices: [{ id: 'b', value: 4 }] }),
      '4',
    );
    assert.equal(
      at({ choiceId: 'b' }, { choices: [{ id: 'b', pictureId: 'apple' }] }),
      content.pictures.apple?.words['de-CH'],
    );
    assert.equal(at({ choiceId: 'x' }, { choices: [] }), null);
    assert.equal(at({ choiceId: 'b' }, { choices: [{ id: 'b' }] }), null);
    assert.equal(at({ coins: ['a'] }), null);
  });
});
