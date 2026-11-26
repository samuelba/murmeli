import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { CONTENT_ROOT } from '../schema/load.ts';

export const FIXTURE_PICTURES = [
  'apple',
  'mouse',
  'cat',
  'monkey',
  'shape-circle',
  'shape-square',
];

export interface FixtureData {
  pictures: Record<string, Record<string, unknown>>;
  track: Record<string, unknown>;
  worlds: Record<string, Record<string, unknown>>;
}

export function baseWorld(): Record<string, unknown> {
  return {
    id: 'm-first',
    order: 1,
    grade: 'KG1',
    requires: [],
    title: { 'de-CH': 'Erste Welt', 'en-US': 'First World' },
    scene: 'meadow',
    skills: [
      {
        id: 'm.count',
        lp21: 'MA.1.A.1',
        title: { 'de-CH': 'Zählen', 'en-US': 'Counting' },
      },
    ],
    levels: [
      {
        id: 'm-first-01',
        title: { 'de-CH': 'Eins', 'en-US': 'One' },
        skill: 'm.count',
        demo: {
          exercise: {
            type: 'count-objects',
            params: { min: 2, max: 2, objects: ['apple'] },
          },
          target: 2,
          steps: [
            {
              say: { 'de-CH': 'Schau.', 'en-US': 'Look.' },
              action: { highlight: 'objects' },
            },
            {
              say: { 'de-CH': 'Zwei.', 'en-US': 'Two.' },
              action: { tapAnswer: true },
            },
          ],
        },
        generators: [
          {
            type: 'count-objects',
            weight: 1,
            params: { min: 1, max: 3, objects: ['apple', 'mouse'] },
          },
        ],
      },
    ],
  };
}

export function baseData(): FixtureData {
  const real = YAML.parse(
    fs.readFileSync(path.join(CONTENT_ROOT, 'pictures.yaml'), 'utf8'),
  ) as {
    pictures: Record<string, Record<string, unknown>>;
  };
  return {
    pictures: Object.fromEntries(
      FIXTURE_PICTURES.map((id) => [id, structuredClone(real.pictures[id]!)]),
    ),
    track: {
      id: 'm',
      order: 1,
      locales: ['de-CH', 'en-US'],
      title: { 'de-CH': 'Mathe', 'en-US': 'Math' },
      icon: 'math',
    },
    worlds: { '01-first.yaml': baseWorld() },
  };
}

export function writeFixture(data: FixtureData = baseData()): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'murmeli-content-'));
  fs.mkdirSync(path.join(root, 'pictures'));
  for (const [id, picture] of Object.entries(data.pictures)) {
    const source = path.join(CONTENT_ROOT, 'pictures', `${id}.svg`);
    const file =
      typeof picture['file'] === 'string' ? picture['file'] : `${id}.svg`;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(root, 'pictures', file));
    }
  }
  fs.writeFileSync(
    path.join(root, 'pictures.yaml'),
    YAML.stringify({ pictures: data.pictures }),
  );
  fs.cpSync(
    path.join(CONTENT_ROOT, 'pictures', 'money'),
    path.join(root, 'pictures', 'money'),
    {
      recursive: true,
    },
  );
  fs.cpSync(path.join(CONTENT_ROOT, 'lexicon'), path.join(root, 'lexicon'), {
    recursive: true,
  });
  const trackDir = path.join(root, 'tracks', String(data.track['id']));
  fs.mkdirSync(path.join(trackDir, 'worlds'), { recursive: true });
  fs.writeFileSync(
    path.join(trackDir, 'track.yaml'),
    YAML.stringify(data.track),
  );
  for (const [name, world] of Object.entries(data.worlds)) {
    fs.writeFileSync(
      path.join(trackDir, 'worlds', name),
      YAML.stringify(world),
    );
  }
  return root;
}

export function removeFixture(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}
