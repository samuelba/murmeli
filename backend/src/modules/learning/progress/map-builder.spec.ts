import { loadCurriculum } from '../content/curriculum';
import { buildMap } from './map-builder';
import { type ProgressLookup, computeStates } from './unlock';

describe('buildMap', () => {
  const curriculum = loadCurriculum(undefined);

  function map(
    locale: 'de-CH' | 'en-US',
    startClass: 'KG1' | '1',
    progress: ProgressLookup = new Map(),
  ) {
    return buildMap(
      curriculum.tracksFor(locale),
      locale,
      computeStates(curriculum.worlds, startClass, progress),
      progress,
    );
  }

  it('localizes tracks, worlds and levels for the kid', () => {
    const en = map('en-US', 'KG1');
    expect(en.tracks.map((t) => t.id)).toEqual(['math', 'reading-en']);
    expect(en.tracks[0]).toMatchObject({ title: 'Math', icon: 'math' });
    expect(en.tracks[0].worlds[0]).toMatchObject({
      id: 'math-zahlenwiese',
      title: 'Number Meadow',
      grade: 'KG1',
      state: 'unlocked',
      stars: 0,
    });
    expect(map('de-CH', 'KG1').tracks[0].worlds[0].title).toBe('Zahlenwiese');
  });

  it('sums stars per world against 3 per level', () => {
    const progress: ProgressLookup = new Map([
      ['math-zahlenwiese-01', { stars: 3, passed: true }],
      ['math-zahlenwiese-02', { stars: 1, passed: false }],
    ]);
    const world = map('de-CH', 'KG1', progress).tracks[0].worlds[0];
    expect(world.stars).toBe(4);
    expect(world.maxStars).toBe(world.levels.length * 3);
    expect(world.levels.slice(0, 3)).toEqual([
      expect.objectContaining({ state: 'passed', stars: 3 }),
      expect.objectContaining({ state: 'unlocked', stars: 1 }),
      expect.objectContaining({ state: 'locked', stars: 0 }),
    ]);
  });

  it('places a class 1 kid', () => {
    const worlds = map('de-CH', '1').tracks[0].worlds;
    expect(worlds.find((w) => w.id === 'math-zahlenbach')?.state).toBe(
      'skipped',
    );
    const hut = worlds.find((w) => w.id === 'math-zehnerhuette')!;
    expect(hut.state).toBe('unlocked');
    expect(hut.levels[0].state).toBe('unlocked');
  });

  it('defaults unknown states to locked', () => {
    const empty = { levels: new Map(), worlds: new Map() };
    const result = buildMap(
      curriculum.tracksFor('en-US'),
      'en-US',
      empty,
      new Map(),
    );
    expect(result.tracks[0].worlds[0].state).toBe('locked');
    expect(result.tracks[0].worlds[0].levels[0].state).toBe('locked');
    expect(result.badges).toEqual([]);
  });

  it('lists the earned badge ids', () => {
    const result = buildMap(
      curriculum.tracksFor('de-CH'),
      'de-CH',
      { levels: new Map(), worlds: new Map() },
      new Map(),
      ['first-level', 'first-practice'],
    );
    expect(result.badges).toEqual(['first-level', 'first-practice']);
  });
});
