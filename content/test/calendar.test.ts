import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  CALENDAR_ASKS,
  calendarNames,
  calendarStep,
  checkAnswer,
  createRng,
  displayOrder,
  exerciseTypeDef,
  generateExercise,
  loadContent,
  parseExerciseParams,
  renderPrompt,
  resolveSlot,
  seasonOfMonth,
} from '../schema/index.ts';
import type {
  CalendarPayload,
  CalendarUnit,
  ExerciseSpec,
  Locale,
} from '../schema/index.ts';

const content = loadContent();
const LOCALES: Locale[] = ['de-CH', 'en-US'];

function spec(params: unknown): ExerciseSpec {
  const parsed = parseExerciseParams('calendar', params, { minDistinct: 1 });
  assert.ok(parsed.success, JSON.stringify(parsed));
  return parsed.spec;
}

function answerLabel(g: ReturnType<typeof generateExercise>): string {
  const payload = g.payload as CalendarPayload;
  const id = (g.solution.answer as { choiceId: string }).choiceId;
  return payload.choices.find((c) => c.id === id)!.label;
}

describe('calendar names', () => {
  it('names days, months, seasons and times of day in both languages', () => {
    assert.deepEqual(calendarNames('weekday', 'de-CH').slice(0, 3), [
      'Montag',
      'Dienstag',
      'Mittwoch',
    ]);
    assert.equal(calendarNames('weekday', 'de-CH')[5], 'Samstag');
    assert.equal(calendarNames('month', 'de-CH')[2], 'März');
    assert.deepEqual(calendarNames('season', 'en-US'), [
      'spring',
      'summer',
      'fall',
      'winter',
    ]);
    assert.deepEqual(calendarNames('daytime', 'de-CH'), [
      'Morgen',
      'Mittag',
      'Abend',
      'Nacht',
    ]);
    for (const unit of Object.keys(CALENDAR_ASKS) as CalendarUnit[]) {
      for (const locale of LOCALES) {
        const names = calendarNames(unit, locale);
        assert.equal(new Set(names).size, names.length);
        assert.equal(/[ßẞ]/u.test(names.join()), false);
      }
    }
  });

  it('starts the week on Monday in de-CH and on Sunday in en-US', () => {
    assert.deepEqual(displayOrder('weekday', 'de-CH'), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(displayOrder('weekday', 'en-US'), [6, 0, 1, 2, 3, 4, 5]);
    assert.deepEqual(
      displayOrder('month', 'en-US'),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
  });

  it('puts December to February in winter and March to May in spring', () => {
    const winter = 3;
    const spring = 0;
    assert.deepEqual([11, 0, 1].map(seasonOfMonth), [winter, winter, winter]);
    assert.deepEqual([2, 3, 4].map(seasonOfMonth), [spring, spring, spring]);
    assert.deepEqual([5, 8].map(seasonOfMonth), [1, 2]);
  });
});

describe('calendar params', () => {
  it('rejects questions that do not fit the unit', () => {
    for (const [unit, ask] of [
      ['daytime', 'next'],
      ['weekday', 'scene'],
      ['month', 'relative'],
      ['season', 'season'],
    ]) {
      const parsed = parseExerciseParams(
        'calendar',
        { unit, ask },
        { minDistinct: 1 },
      );
      assert.equal(parsed.success, false, `${unit}/${ask}`);
    }
  });

  it('rejects a relation without relative and a missing name without strip', () => {
    for (const params of [
      { unit: 'weekday', ask: 'next', relation: 'tomorrow' },
      { unit: 'month', ask: 'missing', strip: false },
    ]) {
      const parsed = parseExerciseParams('calendar', params, {
        minDistinct: 1,
      });
      assert.equal(parsed.success, false, JSON.stringify(params));
    }
  });

  it('lists the names it speaks for prompts and choices', () => {
    const def = exerciseTypeDef('calendar');
    const ctx = { locale: 'de-CH' as const, pictures: {} };
    const relative = spec({ unit: 'weekday', ask: 'relative' });
    const uses = def.frameUses(relative.params, ctx);
    assert.deepEqual(
      uses.map((use) => use.frame),
      ['weekday-tomorrow', 'weekday-yesterday'],
    );
    assert.equal(uses[0]!.slots['name']!.length, 7);
    const missing = spec({ unit: 'month', ask: 'missing' });
    assert.deepEqual(def.frameUses(missing.params, ctx)[0]!.slots, {});
    const season = spec({ unit: 'month', ask: 'season' });
    assert.deepEqual(def.labels!(season.params, ctx), [
      'Frühling',
      'Sommer',
      'Herbst',
      'Winter',
    ]);
  });

  it('fills the name slot with the text as it is', () => {
    assert.equal(resolveSlot(content, 'text', 'Montag', 'de-CH'), 'Montag');
    assert.equal(resolveSlot(content, 'text', 3, 'de-CH'), undefined);
  });
});

describe('calendar exercises', () => {
  it('asks for the day after Monday and offers Monday itself as a trap', () => {
    const g = generateExercise(
      spec({ unit: 'weekday', ask: 'next', choices: 3 }),
      createRng(1),
      { locale: 'de-CH', content, demo: { target: 0 } },
    );
    const payload = g.payload as CalendarPayload;
    assert.equal(g.prompt.text, 'Welcher Tag kommt nach Montag?');
    assert.deepEqual(g.prompt.speak, ['Welcher Tag kommt nach', 'Montag']);
    assert.equal(answerLabel(g), 'Dienstag');
    assert.ok(payload.choices.some((c) => c.label === 'Montag'));
    assert.equal(payload.focus, 0);
    assert.equal(payload.name, 'Montag');
    assert.equal(g.focus, 0);
    assert.equal(g.solution.hint, 'say-the-days');
  });

  it('wraps around the end of the week and the year', () => {
    const sunday = generateExercise(
      spec({ unit: 'weekday', ask: 'next' }),
      createRng(2),
      { locale: 'en-US', content, demo: { target: 6 } },
    );
    assert.equal(answerLabel(sunday), 'Monday');
    const january = generateExercise(
      spec({ unit: 'month', ask: 'before' }),
      createRng(2),
      { locale: 'de-CH', content, demo: { target: 0 } },
    );
    assert.equal(january.prompt.text, 'Welcher Monat kommt vor dem Januar?');
    assert.equal(answerLabel(january), 'Dezember');
  });

  it('leaves a gap in the strip and never shows the missing name', () => {
    const g = generateExercise(
      spec({ unit: 'weekday', ask: 'missing', choices: 4 }),
      createRng(3),
      { locale: 'en-US', content, demo: { target: 2 } },
    );
    const payload = g.payload as CalendarPayload;
    assert.equal(answerLabel(g), 'Wednesday');
    assert.equal(payload.gap, 2);
    assert.equal(payload.ring.length, 7);
    assert.equal(payload.ring[0]!.index, 6);
    const gap = payload.ring.find((card) => card.index === 2)!;
    assert.equal(gap.label, null);
    assert.ok(payload.ring.every((card) => card.label !== 'Wednesday'));
  });

  it('asks about tomorrow and yesterday', () => {
    const tomorrow = generateExercise(
      spec({ unit: 'weekday', ask: 'relative', relation: 'tomorrow' }),
      createRng(4),
      { locale: 'de-CH', content, demo: { target: 4 } },
    );
    assert.equal(
      tomorrow.prompt.text,
      'Heute ist Freitag. Welcher Tag ist morgen?',
    );
    assert.equal(answerLabel(tomorrow), 'Samstag');
    const yesterday = generateExercise(
      spec({ unit: 'weekday', ask: 'relative', relation: 'yesterday' }),
      createRng(4),
      { locale: 'en-US', content, demo: { target: 0 } },
    );
    assert.equal(
      yesterday.prompt.text,
      'Today is Monday. What day was yesterday?',
    );
    assert.equal(answerLabel(yesterday), 'Sunday');
    assert.equal((yesterday.payload as CalendarPayload).relation, 'yesterday');
  });

  it('shows a scene for the time of day and the season', () => {
    const night = generateExercise(
      spec({ unit: 'daytime', ask: 'scene', choices: 4 }),
      createRng(5),
      { locale: 'de-CH', content, demo: { target: 3 } },
    );
    const payload = night.payload as CalendarPayload;
    assert.equal(night.prompt.text, 'Welche Tageszeit ist es?');
    assert.equal(payload.scene, 3);
    assert.equal(payload.ring.length, 0);
    assert.equal(answerLabel(night), 'Nacht');
    assert.equal(payload.choices.length, 4);
  });

  it('asks which season a month belongs to', () => {
    const g = generateExercise(
      spec({ unit: 'month', ask: 'season' }),
      createRng(6),
      { locale: 'en-US', content, demo: { target: 6 } },
    );
    assert.equal(g.prompt.text, 'Which season is it in July?');
    assert.equal(answerLabel(g), 'summer');
  });

  it('hides the strip when asked to', () => {
    const g = generateExercise(
      spec({ unit: 'month', ask: 'next', strip: false }),
      createRng(7),
      { locale: 'de-CH', content },
    );
    const payload = g.payload as CalendarPayload;
    assert.equal(payload.ring.length, 0);
    assert.equal(
      payload.name,
      payload.focus === null
        ? null
        : calendarNames('month', 'de-CH')[payload.focus],
    );
    assert.notEqual(payload.name, null);
  });

  it('always offers the answer exactly once among distinct choices', () => {
    const combos = Object.entries(CALENDAR_ASKS).flatMap(([unit, asks]) =>
      asks.map((ask) => ({ unit, ask })),
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...combos),
        fc.constantFrom(...LOCALES),
        fc.integer({ min: 2, max: 4 }),
        fc.integer(),
        ({ unit, ask }, locale, choices, seed) => {
          const g = generateExercise(
            spec({ unit, ask, choices }),
            createRng(seed),
            { locale, content },
          );
          const payload = g.payload as CalendarPayload;
          const subject = g.focus as number;
          const answerUnit =
            ask === 'season' ? 'season' : (unit as CalendarUnit);
          const delta =
            ask === 'next' || payload.relation === 'tomorrow'
              ? 1
              : ask === 'before' || payload.relation === 'yesterday'
                ? -1
                : 0;
          const expected =
            ask === 'season'
              ? seasonOfMonth(subject)
              : calendarStep(unit as CalendarUnit, subject, delta);
          assert.equal(
            answerLabel(g),
            calendarNames(answerUnit, locale)[expected],
          );
          assert.ok(
            payload.ring.every(
              (card) => card.label !== answerLabel(g) || ask !== 'missing',
            ),
          );
          const labels = payload.choices.map((c) => c.label);
          assert.equal(labels.length, choices);
          assert.equal(new Set(labels).size, labels.length);
          assert.ok(checkAnswer(g.solution, g.solution.answer).correct);
          const wrong = payload.choices.find(
            (c) =>
              c.id !== (g.solution.answer as { choiceId: string }).choiceId,
          )!;
          assert.equal(
            checkAnswer(g.solution, { choiceId: wrong.id }).correct,
            false,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('renders every prompt frame in both languages', () => {
    const frames = Object.keys(exerciseTypeDef('calendar').frames);
    assert.equal(frames.length, 14);
    for (const locale of LOCALES) {
      for (const frame of frames) {
        const prompt = renderPrompt(content, 'calendar', frame, locale, {
          name: 'X',
        });
        assert.ok(prompt.text.length > 0, frame);
        assert.equal(/[ßẞ]/u.test(prompt.text), false);
      }
    }
  });

  it('gives a hint that fits the question', () => {
    const hint = (params: unknown) =>
      generateExercise(spec(params), createRng(1), {
        locale: 'de-CH',
        content,
      }).solution.hint;
    assert.equal(hint({ unit: 'month', ask: 'next' }), 'say-the-months');
    assert.equal(hint({ unit: 'month', ask: 'season' }), 'month-season');
    assert.equal(hint({ unit: 'season', ask: 'before' }), 'season-order');
    assert.equal(hint({ unit: 'season', ask: 'scene' }), 'season-signs');
    assert.equal(hint({ unit: 'daytime', ask: 'scene' }), 'look-at-the-sky');
  });

  it('falls back to the first item for a demo target out of range', () => {
    const g = generateExercise(
      spec({ unit: 'season', ask: 'next' }),
      createRng(1),
      { locale: 'de-CH', content, demo: { target: 9 } },
    );
    assert.equal(g.focus, 0);
  });
});
