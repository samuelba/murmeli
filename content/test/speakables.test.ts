import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectSpeakables,
  contentStats,
  exerciseTypeDef,
  formatStats,
  loadContent,
  renderPrompt,
} from '../schema/index.ts';
import type { Locale, SlotValue } from '../schema/index.ts';

const content = loadContent();

function pick<T>(values: readonly T[], seed: number): T {
  return values[seed % values.length]!;
}

describe('speakables', () => {
  for (const locale of ['de-CH', 'en-US'] as Locale[]) {
    const speakables = collectSpeakables(content, locale);
    const texts = new Set(speakables.map((s) => s.text));

    it(`lists titles, demo sentences, frames and lexicon entries for ${locale}`, () => {
      const sources = speakables.flatMap((s) => s.sources);
      for (const prefix of [
        'track:',
        'world:',
        'level:',
        'frame:',
        'slot:',
        'lexicon:numbers',
        'lexicon:feedback',
      ]) {
        assert.ok(
          sources.some((source) => source.startsWith(prefix)),
          prefix,
        );
      }
      assert.equal(
        new Set(speakables.map((s) => `${s.text}|${s.speak ?? ''}`)).size,
        speakables.length,
      );
    });

    it(`covers every segment a generator can produce in ${locale}`, () => {
      let checked = 0;
      for (const track of content.tracks.filter((t) =>
        t.locales.includes(locale),
      )) {
        for (const level of track.worlds.flatMap((w) => w.levels)) {
          for (const spec of [level.demo.exercise, ...level.generators]) {
            const uses = exerciseTypeDef(spec.type).frameUses(spec.params, {
              locale,
              pictures: content.pictures,
            });
            for (const [n, use] of uses.entries()) {
              for (let seed = 0; seed < 5; seed += 1) {
                const values: Record<string, SlotValue> = {};
                for (const [slot, options] of Object.entries(use.slots)) {
                  values[slot] = pick(options, seed * 7 + n);
                }
                const prompt = renderPrompt(
                  content,
                  spec.type,
                  use.frame,
                  locale,
                  values,
                );
                for (const segment of prompt.speak) {
                  assert.ok(
                    texts.has(segment),
                    `${spec.type}.${use.frame}: "${segment}" missing`,
                  );
                  checked += 1;
                }
              }
            }
          }
        }
      }
      assert.ok(checked > 500);
    });
  }

  it('keeps reading-de strings out of the English list', () => {
    const english = collectSpeakables(content, 'en-US').map((s) => s.text);
    assert.ok(!english.includes('Lautwiese'));
    assert.ok(english.includes('Number Meadow'));
  });

  it('carries the spoken form of numbers and letters', () => {
    const german = collectSpeakables(content, 'de-CH');
    assert.equal(german.find((s) => s.text === '7')?.speak, 'sieben');
    assert.equal(german.find((s) => s.text === 'M')?.speak, 'Em');
  });
});

describe('stats', () => {
  it('counts tracks, worlds and levels per grade', () => {
    const stats = contentStats(content);
    assert.equal(stats.totals.tracks, 3);
    assert.equal(stats.totals.exerciseTypes, 22);
    const math = stats.tracks.find((t) => t.id === 'math')!;
    assert.equal(math.byGrade.KG1.worlds, 2);
    assert.equal(
      math.levels,
      math.worlds.reduce((sum, w) => sum + w.levels, 0),
    );
    const text = formatStats(stats);
    assert.match(text, /math \[de-CH, en-US\]/);
    assert.match(text, /total: 3 tracks/);
  });
});
