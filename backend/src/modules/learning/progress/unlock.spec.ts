import fc from 'fast-check';
import type { Grade, World } from '@murmeli/content';
import {
  type LevelSnapshot,
  type ProgressLookup,
  computeStates,
  isOpen,
  isPlaced,
  unlockedBetween,
} from './unlock';

function world(
  id: string,
  grade: Grade,
  requires: string[],
  levels = 3,
): World {
  return {
    id,
    grade,
    requires,
    levels: Array.from({ length: levels }, (_, i) => ({
      id: `${id}-0${i + 1}`,
    })),
  } as unknown as World;
}

const WORLDS: World[] = [
  world('meadow', 'KG1', []),
  world('forest', 'KG1', []),
  world('brook', 'KG2', ['meadow']),
  world('hut', '1', ['brook']),
  world('bridge', '1', ['hut']),
  world('summit', '2', ['bridge', 'forest']),
];
const LEVEL_IDS = WORLDS.flatMap((w) => w.levels.map((l) => l.id));

function passed(...ids: string[]): ProgressLookup {
  return new Map(
    ids.map((id): [string, LevelSnapshot] => [id, { stars: 2, passed: true }]),
  );
}

function allOf(worldId: string): string[] {
  return WORLDS.find((w) => w.id === worldId)!.levels.map((l) => l.id);
}

describe('computeStates', () => {
  it('opens only the first level of worlds without requirements for a new KG1 kid', () => {
    const { levels, worlds } = computeStates(WORLDS, 'KG1', new Map());

    expect(levels.get('meadow-01')).toBe('unlocked');
    expect(levels.get('meadow-02')).toBe('locked');
    expect(levels.get('forest-01')).toBe('unlocked');
    expect(levels.get('brook-01')).toBe('locked');
    expect(worlds.get('meadow')).toBe('unlocked');
    expect(worlds.get('brook')).toBe('locked');
    expect(worlds.get('summit')).toBe('locked');
  });

  it('opens levels in order as the previous one is passed', () => {
    const { levels } = computeStates(WORLDS, 'KG1', passed('meadow-01'));

    expect(levels.get('meadow-01')).toBe('passed');
    expect(levels.get('meadow-02')).toBe('unlocked');
    expect(levels.get('meadow-03')).toBe('locked');
  });

  it('opens a world once every required world is completed', () => {
    const { levels, worlds } = computeStates(
      WORLDS,
      'KG1',
      passed(...allOf('meadow')),
    );

    expect(worlds.get('meadow')).toBe('passed');
    expect(worlds.get('brook')).toBe('unlocked');
    expect(levels.get('brook-01')).toBe('unlocked');
    expect(levels.get('hut-01')).toBe('locked');
  });

  it('needs every required world, not just one', () => {
    const progress = passed(
      ...allOf('meadow'),
      ...allOf('brook'),
      ...allOf('hut'),
      ...allOf('bridge'),
    );

    expect(computeStates(WORLDS, 'KG1', progress).worlds.get('summit')).toBe(
      'locked',
    );
    expect(
      computeStates(
        WORLDS,
        'KG1',
        new Map([...progress, ...passed(...allOf('forest'))]),
      ).worlds.get('summit'),
    ).toBe('unlocked');
  });

  it('places a class 1 kid: kindergarten worlds are skipped and class 1 opens', () => {
    const { levels, worlds } = computeStates(WORLDS, '1', new Map());

    for (const id of ['meadow', 'forest', 'brook']) {
      expect(worlds.get(id)).toBe('skipped');
    }
    expect(levels.get('meadow-03')).toBe('skipped');
    expect(levels.get('brook-02')).toBe('skipped');
    expect(levels.get('hut-01')).toBe('unlocked');
    expect(levels.get('hut-02')).toBe('locked');
    expect(worlds.get('bridge')).toBe('locked');
  });

  it('shows passed levels of skipped worlds as passed', () => {
    const { levels, worlds } = computeStates(WORLDS, '1', passed('meadow-01'));
    expect(levels.get('meadow-01')).toBe('passed');
    expect(worlds.get('meadow')).toBe('skipped');
    expect(
      computeStates(WORLDS, '1', passed(...allOf('meadow'))).worlds.get(
        'meadow',
      ),
    ).toBe('passed');
  });

  it('places a class 2 kid up to the summit', () => {
    const { levels } = computeStates(WORLDS, '2', new Map());
    expect(levels.get('summit-01')).toBe('unlocked');
    expect(levels.get('bridge-03')).toBe('skipped');
  });

  it('treats unknown and cyclic requirements as not completed', () => {
    const cyclic = [
      world('a', 'KG1', ['b']),
      world('b', 'KG1', ['a']),
      world('c', 'KG1', ['missing']),
    ];
    const { worlds } = computeStates(cyclic, 'KG1', new Map());
    expect([...worlds.values()]).toEqual(['locked', 'locked', 'locked']);
  });

  it('keeps a level passed even when its world is no longer open', () => {
    const { levels } = computeStates(WORLDS, 'KG1', passed('hut-01'));
    expect(levels.get('hut-01')).toBe('passed');
    expect(levels.get('hut-02')).toBe('locked');
  });
});

describe('unlockedBetween', () => {
  it('lists the levels and worlds that were locked before', () => {
    const before = computeStates(
      WORLDS,
      'KG1',
      passed('meadow-01', 'meadow-02'),
    );
    const after = computeStates(WORLDS, 'KG1', passed(...allOf('meadow')));

    expect(unlockedBetween(before, after)).toEqual({
      levels: ['brook-01'],
      worlds: ['brook'],
    });
  });

  it('is empty when nothing changed', () => {
    const states = computeStates(WORLDS, 'KG1', new Map());
    expect(unlockedBetween(states, states)).toEqual({
      levels: [],
      worlds: [],
    });
  });
});

describe('helpers', () => {
  it('isPlaced compares grades', () => {
    expect(isPlaced({ grade: 'KG2' }, '1')).toBe(true);
    expect(isPlaced({ grade: '1' }, '1')).toBe(false);
  });

  it('isOpen is false only for locked and unknown states', () => {
    expect(isOpen('locked')).toBe(false);
    expect(isOpen(undefined)).toBe(false);
    expect(isOpen('skipped')).toBe(true);
  });
});

describe('unlock properties', () => {
  const grade = fc.constantFrom<Grade>('KG1', 'KG2', '1', '2');
  const progress = fc.subarray(LEVEL_IDS).map((ids) => passed(...ids));

  it('passing a level never locks anything', () => {
    fc.assert(
      fc.property(
        grade,
        progress,
        fc.constantFrom(...LEVEL_IDS),
        (startClass, before, levelId) => {
          const after = new Map(before);
          after.set(levelId, { stars: 3, passed: true });
          const a = computeStates(WORLDS, startClass, before);
          const b = computeStates(WORLDS, startClass, after);
          for (const [id, state] of a.levels) {
            if (state !== 'locked') {
              expect(b.levels.get(id)).not.toBe('locked');
            }
          }
          for (const [id, state] of a.worlds) {
            if (state !== 'locked') {
              expect(b.worlds.get(id)).not.toBe('locked');
            }
          }
        },
      ),
    );
  });

  it('a higher start class never locks anything', () => {
    fc.assert(
      fc.property(progress, (lookup) => {
        const grades: Grade[] = ['KG1', 'KG2', '1', '2'];
        for (let i = 1; i < grades.length; i += 1) {
          const lower = computeStates(WORLDS, grades[i - 1], lookup);
          const higher = computeStates(WORLDS, grades[i], lookup);
          for (const [id, state] of lower.levels) {
            if (state !== 'locked') {
              expect(higher.levels.get(id)).not.toBe('locked');
            }
          }
        }
      }),
    );
  });

  it('every open world has an open first level', () => {
    fc.assert(
      fc.property(grade, progress, (startClass, lookup) => {
        const { levels, worlds } = computeStates(WORLDS, startClass, lookup);
        for (const w of WORLDS) {
          if (worlds.get(w.id) !== 'locked') {
            expect(levels.get(w.levels[0].id)).not.toBe('locked');
          }
        }
      }),
    );
  });
});
