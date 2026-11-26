import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cleanSegment,
  EXERCISE_TYPE_IDS,
  frameSlots,
  LOCALES,
  loadContent,
  parseExerciseParams,
  parseTemplate,
  PROMPT_FRAME_SEGMENTS,
  PROMPT_FRAMES,
  renderPrompt,
  resolveSlot,
  speakSegments,
  staticSegments,
} from '../schema/index.ts';
import type { PromptFrame } from '../schema/index.ts';

const content = loadContent();

describe('prompt templates', () => {
  it('splits templates into text and slots', () => {
    assert.deepEqual(parseTemplate('Wie viele {plural:object} siehst du?'), [
      { type: 'text', text: 'Wie viele ' },
      { type: 'slot', kind: 'plural', name: 'object' },
      { type: 'text', text: ' siehst du?' },
    ]);
    assert.deepEqual(parseTemplate('{number}'), [
      { type: 'slot', kind: 'number', name: 'number' },
    ]);
    assert.throws(() => parseTemplate('{color:x}'), /unknown slot kind/);
  });

  it('turns templates into speakable segments without placeholders', () => {
    assert.deepEqual(speakSegments('Wie viele {plural:object} siehst du?'), [
      'Wie viele',
      { slot: 'object', kind: 'plural' },
      'siehst du?',
    ]);
    assert.deepEqual(
      staticSegments('Wie viel ist {number:a} plus {number:b}?'),
      ['Wie viel ist', 'plus'],
    );
    assert.equal(cleanSegment('. ?'), undefined);
    assert.equal(cleanSegment('. Welcher Buchstabe?'), 'Welcher Buchstabe?');
  });

  it('uses the same slots in every locale', () => {
    for (const id of EXERCISE_TYPE_IDS) {
      for (const [key, frame] of Object.entries(
        PROMPT_FRAMES[id] as Record<string, PromptFrame>,
      )) {
        const slots = LOCALES.map((locale) =>
          parseTemplate(frame.speak[locale])
            .filter((part) => part.type === 'slot')
            .map((part) =>
              part.type === 'slot' ? `${part.kind}:${part.name}` : '',
            )
            .sort()
            .join(','),
        );
        assert.equal(new Set(slots).size, 1, `${id}.${key}`);
        assert.ok(PROMPT_FRAME_SEGMENTS[id][key]?.['de-CH']);
        assert.ok(Object.keys(frameSlots(id, key)).length >= 0);
      }
    }
  });

  it('never uses the sharp s in de-CH frames', () => {
    const text = JSON.stringify(PROMPT_FRAMES);
    assert.equal(/[ßẞ]/u.test(text), false);
  });
});

describe('renderPrompt', () => {
  it('renders count-objects with plurals', () => {
    assert.deepEqual(
      renderPrompt(content, 'count-objects', 'main', 'de-CH', {
        object: 'apple',
      }),
      {
        text: 'Wie viele Äpfel siehst du?',
        speak: ['Wie viele', 'Äpfel', 'siehst du?'],
      },
    );
    assert.deepEqual(
      renderPrompt(content, 'count-objects', 'main', 'en-US', {
        object: 'mouse',
      }).speak,
      ['How many', 'mice', 'do you see?'],
    );
  });

  it('renders numbers and drops punctuation-only segments', () => {
    assert.deepEqual(
      renderPrompt(content, 'add-sub', 'add', 'de-CH', { a: 7, b: 5 }),
      {
        text: 'Wie viel ist 7 plus 5?',
        speak: ['Wie viel ist', '7', 'plus', '5'],
      },
    );
  });

  it('uses a separate display text that hides the answer', () => {
    const prompt = renderPrompt(content, 'letter-sound', 'main', 'de-CH', {
      target: 'M',
    });
    assert.equal(prompt.text, 'Welcher Buchstabe passt?');
    assert.deepEqual(prompt.speak, [
      'Hör gut zu:',
      'M wie Maus',
      'Welcher Buchstabe passt?',
    ]);
  });

  it('adds articles for the-word slots', () => {
    assert.deepEqual(
      renderPrompt(content, 'shape-pick', 'main', 'de-CH', {
        shape: 'shape-circle',
      }).speak,
      ['Wo ist', 'der Kreis'],
    );
    assert.deepEqual(
      renderPrompt(content, 'shape-pick', 'main', 'en-US', {
        shape: 'shape-square',
      }).speak,
      ['Where is', 'the square'],
    );
  });

  it('throws on missing or unknown values and frames', () => {
    assert.throws(
      () => renderPrompt(content, 'add-sub', 'add', 'de-CH', { a: 1 }),
      /cannot fill slot "b"/,
    );
    assert.throws(
      () => renderPrompt(content, 'add-sub', 'add', 'de-CH', { a: 1, b: 101 }),
      /cannot fill/,
    );
    assert.throws(
      () => renderPrompt(content, 'add-sub', 'nope', 'de-CH', {}),
      /no prompt frame/,
    );
  });

  it('resolves every slot kind', () => {
    assert.equal(resolveSlot(content, 'word', 'mouse', 'de-CH'), 'Maus');
    assert.equal(resolveSlot(content, 'letter', 'M', 'en-US'), 'M');
    assert.equal(resolveSlot(content, 'letter', 'Zz', 'en-US'), undefined);
    assert.equal(
      resolveSlot(content, 'carrier', 'Sch', 'de-CH'),
      'Sch wie Schule',
    );
    assert.equal(resolveSlot(content, 'number', '7', 'de-CH'), undefined);
    assert.equal(resolveSlot(content, 'the-word', 'nope', 'de-CH'), undefined);
  });

  it('re-parses every loaded exercise spec unchanged', () => {
    for (const level of content.tracks.flatMap((t) =>
      t.worlds.flatMap((w) => w.levels),
    )) {
      for (const spec of [level.demo.exercise, ...level.generators]) {
        const parsed = parseExerciseParams(spec.type, spec.params, {
          minDistinct: 1,
        });
        assert.ok(parsed.success);
        assert.deepEqual(parsed.spec.params, spec.params);
      }
    }
  });
});
