import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContentValidationError } from '@murmeli/content';
import {
  Curriculum,
  LEVEL_ID_PATTERN,
  loadCurriculum,
  localize,
} from './curriculum';
import { CurriculumProvider } from './curriculum.provider';
import { computeStates, isOpen } from '../progress/unlock';

describe('Curriculum', () => {
  const curriculum = loadCurriculum(undefined);

  it('loads the bundled content', () => {
    expect(curriculum.content.tracks.length).toBeGreaterThanOrEqual(3);
    expect(curriculum.worlds.length).toBeGreaterThan(0);
  });

  it.each(['de-CH', 'en-US'] as const)(
    'gives a new %s kid open levels with generators, so practice always has items',
    (locale) => {
      const states = computeStates(
        curriculum.worldsFor(locale),
        'KG1',
        new Map(),
      );
      const open = curriculum
        .levelsFor(locale)
        .filter((level) => isOpen(states.levels.get(level.id)));

      expect(open.length).toBeGreaterThan(0);
      expect(open.every((level) => level.generators.length > 0)).toBe(true);
    },
  );

  it('shows a kid only the tracks of their language', () => {
    expect(curriculum.tracksFor('de-CH').map((t) => t.id)).toEqual([
      'math',
      'reading-de',
    ]);
    expect(curriculum.tracksFor('en-US').map((t) => t.id)).toEqual([
      'math',
      'reading-en',
    ]);
    expect(
      curriculum.levelsFor('en-US').some((l) => l.id.startsWith('reading-de')),
    ).toBe(false);
  });

  it('finds levels only in the kid’s tracks', () => {
    expect(curriculum.levelFor('math-zahlenwiese-01', 'en-US')?.worldId).toBe(
      'math-zahlenwiese',
    );
    expect(curriculum.levelFor('reading-de-lautwiese-01', 'en-US')).toBe(
      undefined,
    );
    expect(curriculum.levelFor('nope', 'de-CH')).toBe(undefined);
  });

  it('names skills in the kid’s language', () => {
    expect(curriculum.skillTitle('math.count.to5', 'en-US')).toBe(
      'Counting to 5',
    );
    expect(curriculum.skillTitle('unknown.skill', 'en-US')).toBe(
      'unknown.skill',
    );
  });

  it('accepts every level id of the content with LEVEL_ID_PATTERN', () => {
    for (const id of Object.keys(curriculum.content.index.levels)) {
      expect(id).toMatch(LEVEL_ID_PATTERN);
    }
  });

  it('fails fast with the validation issues when the content is invalid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'murmeli-content-'));
    try {
      expect(() => loadCurriculum(dir)).toThrow(ContentValidationError);
      expect(() => loadCurriculum(dir)).toThrow(/no tracks found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is provided from CONTENT_DIR', () => {
    const factory = (
      CurriculumProvider as { useFactory: (c: unknown) => unknown }
    ).useFactory;
    const config = { get: jest.fn().mockReturnValue(undefined) };
    expect(factory(config)).toBeInstanceOf(Curriculum);
    expect(config.get).toHaveBeenCalledWith('CONTENT_DIR', { infer: true });
  });
});

describe('localize', () => {
  it('falls back to any available text', () => {
    expect(localize({ 'de-CH': 'Hallo' }, 'en-US')).toBe('Hallo');
    expect(localize({}, 'en-US')).toBe('');
  });
});
