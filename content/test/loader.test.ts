import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  ContentValidationError,
  formatIssue,
  LOCALES,
  loadContent,
  validateContent,
} from '../schema/index.ts';
import { baseData, baseWorld, removeFixture, writeFixture } from './fixture.ts';
import type { FixtureData } from './fixture.ts';

const roots: string[] = [];
after(() => roots.forEach(removeFixture));

function issuesFor(
  mutate: (data: FixtureData) => void,
  edit?: (root: string) => void,
): string[] {
  const data = baseData();
  mutate(data);
  const root = writeFixture(data);
  roots.push(root);
  edit?.(root);
  return validateContent(root).issues.map(formatIssue);
}

function level(
  world: Record<string, unknown>,
  index = 0,
): Record<string, unknown> {
  return (world['levels'] as Record<string, unknown>[])[index]!;
}

function allStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(allStrings);
  }
  return [];
}

describe('real content', () => {
  const content = loadContent();

  it('validates cleanly', () => {
    assert.deepEqual(validateContent().issues, []);
  });

  it('has the three tracks with sorted worlds', () => {
    assert.deepEqual(
      content.tracks.map((t) => t.id),
      ['math', 'reading-de', 'reading-en'],
    );
    for (const track of content.tracks) {
      const orders = track.worlds.map((w) => w.order);
      assert.deepEqual(
        orders,
        [...orders].sort((a, b) => a - b),
      );
      assert.ok(
        track.worlds.every((w) => w.levels.length >= 5 && w.levels.length <= 8),
      );
    }
  });

  it('is deeply frozen', () => {
    const level = content.tracks[0]!.worlds[0]!.levels[0]!;
    assert.ok(Object.isFrozen(content));
    assert.ok(Object.isFrozen(level.generators[0]!.params));
    assert.ok(Object.isFrozen(content.pictures['apple']!.words));
    assert.throws(() => {
      (content.tracks as unknown as unknown[]).push(1);
    });
  });

  it('indexes worlds, levels and skills', () => {
    assert.equal(
      content.index.levels['math-zahlenwiese-01']?.worldId,
      'math-zahlenwiese',
    );
    assert.equal(content.index.worlds['math-zahlenwiese']?.trackId, 'math');
    assert.equal(
      content.index.skills['math.count.to5']?.worldId,
      'math-zahlenwiese',
    );
  });

  it('never uses the sharp s in de-CH content, pictures or lexicon', () => {
    const german = [
      ...content.tracks.flatMap((t) => allStrings(t)),
      ...Object.values(content.pictures).flatMap((p) => allStrings(p)),
      ...allStrings(content.lexicons['de-CH']),
    ];
    assert.ok(german.length > 1000);
    assert.deepEqual(
      german.filter((s) => /[ßẞ]/u.test(s)),
      [],
    );
  });

  it('has a lexicon for every locale with numbers 0-100', () => {
    for (const locale of LOCALES) {
      assert.equal(Object.keys(content.lexicons[locale].numbers).length, 101);
    }
  });

  it('contains a superset of the audio pipeline lexicon', () => {
    const toolDir = path.resolve(content.rootDir, '../tools/audio/lexicon');
    if (!fs.existsSync(toolDir)) {
      return;
    }
    for (const locale of LOCALES) {
      const ours = fs.readFileSync(
        path.join(content.rootDir, 'lexicon', `${locale}.yaml`),
        'utf8',
      );
      const theirs = fs.readFileSync(
        path.join(toolDir, `${locale}.yaml`),
        'utf8',
      );
      for (const line of theirs.split('\n').filter((l) => /^\s+\S/.test(l))) {
        assert.ok(ours.includes(line), `${locale} lexicon misses: ${line}`);
      }
    }
  });
});

describe('fixture content', () => {
  it('loads a minimal valid tree', () => {
    const root = writeFixture();
    roots.push(root);
    const content = loadContent(root);
    assert.equal(content.tracks[0]!.worlds[0]!.levels[0]!.demo.target, 2);
    assert.equal(content.tracks[0]!.worlds[0]!.trackId, 'm');
  });

  it('throws an aggregated ContentValidationError', () => {
    const data = baseData();
    data.track['icon'] = 'Not Valid';
    data.worlds['01-first.yaml']!['grade'] = 'KG3';
    const root = writeFixture(data);
    roots.push(root);
    assert.throws(
      () => loadContent(root),
      (error: unknown) =>
        error instanceof ContentValidationError &&
        error.issues.length >= 2 &&
        /track\.yaml: icon/.test(error.message),
    );
  });

  const cases: [
    string,
    (d: FixtureData) => void,
    RegExp,
    ((root: string) => void)?,
  ][] = [
    [
      'duplicate ids',
      (d) => {
        const second = baseWorld();
        second['order'] = 2;
        d.worlds['02-second.yaml'] = second;
      },
      /world id "m-first" is already used/,
    ],
    [
      'unknown required world',
      (d) => {
        d.worlds['01-first.yaml']!['requires'] = ['m-ghost'];
      },
      /requires\[0\]: unknown world "m-ghost"/,
    ],
    [
      'requires cycles',
      (d) => {
        const second = baseWorld();
        second['id'] = 'm-second';
        second['order'] = 2;
        second['skills'] = [
          {
            id: 'm.two',
            lp21: 'MA.1.A.1',
            title: { 'de-CH': 'Zwei', 'en-US': 'Two' },
          },
        ];
        level(second)['id'] = 'm-second-01';
        level(second)['skill'] = 'm.two';
        second['requires'] = ['m-first'];
        d.worlds['02-second.yaml'] = second;
        d.worlds['01-first.yaml']!['requires'] = ['m-second'];
      },
      /requires cycle/,
    ],
    [
      'self requirement',
      (d) => {
        d.worlds['01-first.yaml']!['requires'] = ['m-first'];
      },
      /cannot require itself/,
    ],
    [
      'level skill outside the world',
      (d) => {
        level(d.worlds['01-first.yaml']!)['skill'] = 'm.other';
      },
      /skill "m.other" is not defined/,
    ],
    [
      'unused skill',
      (d) => {
        (d.worlds['01-first.yaml']!['skills'] as unknown[]).push({
          id: 'm.unused',
          lp21: 'MA.1.A.1',
          title: { 'de-CH': 'X', 'en-US': 'X' },
        });
      },
      /skill "m.unused" is not used/,
    ],
    [
      'level id prefix',
      (d) => {
        level(d.worlds['01-first.yaml']!)['id'] = 'other-01';
      },
      /level id must start with "m-first-"/,
    ],
    [
      'unknown picture',
      (d) => {
        level(d.worlds['01-first.yaml']!)['generators'] = [
          {
            type: 'count-objects',
            params: { min: 1, max: 3, objects: ['unicorn-cat'] },
          },
        ];
      },
      /generators\[0\]\.params\.objects\[0\]: unknown picture "unicorn-cat"/,
    ],
    [
      'missing plural for counting',
      (d) => {
        delete (d.pictures['apple']!['plural'] as Record<string, string>)[
          'en-US'
        ];
      },
      /picture "apple" has no plural for en-US/,
    ],
    [
      'invalid generator params',
      (d) => {
        level(d.worlds['01-first.yaml']!)['generators'] = [
          { type: 'add-sub', params: { operations: ['add'], max: 200 } },
        ];
      },
      /generators\[0\]\.params\.max/,
    ],
    [
      'unknown exercise type',
      (d) => {
        level(d.worlds['01-first.yaml']!)['generators'] = [
          { type: 'juggle', params: {} },
        ];
      },
      /unknown exercise type "juggle"/,
    ],
    [
      'demo target not in params',
      (d) => {
        (level(d.worlds['01-first.yaml']!)['demo'] as Record<string, unknown>)[
          'target'
        ] = 'mouse';
      },
      /demo\.target: the de-CH demo shows 2, not the target "mouse"/,
    ],
    [
      'missing locale in a title',
      (d) => {
        level(d.worlds['01-first.yaml']!)['title'] = { 'de-CH': 'Eins' };
      },
      /levels\[0\]\.title: missing en-US text/,
    ],
    [
      'sharp s in YAML',
      (d) => {
        d.worlds['01-first.yaml']!['title'] = {
          'de-CH': 'Grße Welt',
          'en-US': 'Big',
        };
      },
      /line \d+: de-CH text must use "ss"/,
    ],
    [
      'grade order',
      (d) => {
        d.worlds['01-first.yaml']!['grade'] = '2';
        const second = baseWorld();
        second['id'] = 'm-second';
        second['order'] = 2;
        second['grade'] = 'KG1';
        second['skills'] = [
          {
            id: 'm.two',
            lp21: 'MA.1.A.1',
            title: { 'de-CH': 'Zwei', 'en-US': 'Two' },
          },
        ];
        level(second)['id'] = 'm-second-01';
        level(second)['skill'] = 'm.two';
        d.worlds['02-second.yaml'] = second;
      },
      /grade KG1 comes after grade 2/,
    ],
    [
      'order and file prefix',
      (d) => {
        d.worlds['01-first.yaml']!['order'] = 3;
      },
      /order 3 does not match the file prefix 01/,
    ],
    [
      'bad world file name',
      (d) => {
        d.worlds['first.yaml'] = d.worlds['01-first.yaml']!;
        delete d.worlds['01-first.yaml'];
      },
      /world file name must look like/,
    ],
    [
      'track folder mismatch',
      (d) => {
        d.track['title'] = { 'de-CH': 'Mathe' };
      },
      /track\.yaml: title: missing en-US text/,
    ],
    [
      'picture word rules',
      (d) => {
        const apple = d.pictures['apple']!;
        apple['words'] = { 'de-CH': 'apfel', 'en-US': 'Apple' };
        delete apple['article'];
        apple['syllables'] = { 'de-CH': ['Ap', 'fe'] };
      },
      /German nouns need an article[\s\S]*capital letter[\s\S]*lowercase[\s\S]*do not spell/,
    ],
    [
      'first sound must match the word',
      (d) => {
        d.pictures['cat']!['firstSound'] = {
          'en-US': { grapheme: 'K', phoneme: 'k' },
        };
      },
      /"cat" does not start with "K"/,
    ],
    [
      'picture file must match id',
      (d) => {
        d.pictures['cat']!['file'] = 'kitty.svg';
      },
      /pictures\.cat\.file: must be "cat\.svg"/,
    ],
  ];

  for (const [name, mutate, pattern, edit] of cases) {
    it(`reports ${name}`, () => {
      const issues = issuesFor(mutate, edit);
      assert.match(issues.join('\n'), pattern);
    });
  }

  it('reports unsafe and orphan SVGs, invalid YAML and missing files', () => {
    const issues = issuesFor(
      () => undefined,
      (root) => {
        fs.writeFileSync(
          path.join(root, 'pictures', 'cat.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>',
        );
        fs.writeFileSync(path.join(root, 'pictures', 'stray.svg'), '<svg/>');
        fs.writeFileSync(
          path.join(root, 'tracks', 'm', 'worlds', '02-broken.yaml'),
          'id: [unclosed',
        );
        fs.writeFileSync(
          path.join(root, 'tracks', 'm', 'worlds', 'notes.txt'),
          'x',
        );
        fs.rmSync(path.join(root, 'lexicon', 'en-US.yaml'));
      },
    ).join('\n');
    assert.match(
      issues,
      /pictures\/cat\.svg: unsafe SVG: contains an event handler/,
    );
    assert.match(issues, /pictures\/stray\.svg: SVG is not listed/);
    assert.match(issues, /02-broken\.yaml: invalid YAML/);
    assert.match(issues, /notes\.txt: world files must end in \.yaml/);
    assert.match(issues, /lexicon\/en-US\.yaml: file is missing/);
  });

  it('reports an empty content root', () => {
    const root = fs.mkdtempSync(
      path.join(path.dirname(writeFixture()), 'empty-'),
    );
    roots.push(root);
    const issues = validateContent(root).issues.map(formatIssue).join('\n');
    assert.match(issues, /no tracks found/);
    assert.match(issues, /pictures\.yaml: file is missing/);
  });

  it('checks requirements of literacy types against the track locales', () => {
    const issues = issuesFor((d) => {
      const world = d.worlds['01-first.yaml']!;
      level(world)['generators'] = [
        {
          type: 'initial-sound',
          params: { letters: ['Z'], distractors: ['A', 'M'] },
        },
        {
          type: 'syllables',
          params: { pictures: ['apple', 'monkey'], maxSyllables: 1 },
        },
        { type: 'build-word', params: { words: ['monkey'], maxLength: 3 } },
        {
          type: 'shape-pick',
          params: { shapes: ['apple', 'shape-circle'], choices: 2 },
        },
        {
          type: 'letter-sound',
          params: { letters: ['Xy'], distractors: ['A'], choices: 2 },
        },
        {
          type: 'initial-sound',
          params: {
            letters: ['A'],
            distractors: ['M'],
            pictures: ['mouse'],
            choices: 2,
          },
        },
      ];
    }).join('\n');
    assert.match(issues, /no regular de-CH picture starts with "Z"/);
    assert.match(issues, /has 2 syllables in de-CH \(max 1\)/);
    assert.match(issues, /word "Affe" is longer than 3 letters/);
    assert.match(issues, /picture "apple" is not tagged "shape"/);
    assert.match(issues, /no carrier phrase for "Xy"/);
    assert.match(
      issues,
      /picture "mouse" starts with "M", not a target letter/,
    );
  });
});
