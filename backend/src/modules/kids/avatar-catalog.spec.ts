import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AVATAR_ACCESSORIES,
  AVATAR_ANIMALS,
  AVATAR_BACKGROUNDS,
} from './avatar-catalog';

interface Manifest {
  readonly animals: readonly { readonly id: string }[];
  readonly accessories: readonly { readonly id: string }[];
  readonly backgrounds: readonly string[];
}

const MANIFEST_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'brand',
  'avatars',
  'manifest.json',
);
const describeWithManifest = existsSync(MANIFEST_PATH)
  ? describe
  : describe.skip;

describe('avatar catalog', () => {
  it('has unique, non-empty entries', () => {
    for (const list of [
      AVATAR_ANIMALS,
      AVATAR_ACCESSORIES,
      AVATAR_BACKGROUNDS,
    ]) {
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list).size).toBe(list.length);
    }
    expect(
      AVATAR_BACKGROUNDS.every((color) => /^#[0-9A-F]{6}$/i.test(color)),
    ).toBe(true);
  });
});

describeWithManifest('avatar catalog vs brand/avatars/manifest.json', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;

  it('matches the manifest (run `npm run avatars:sync` after changing it)', () => {
    expect({
      animals: AVATAR_ANIMALS,
      accessories: AVATAR_ACCESSORIES,
      backgrounds: AVATAR_BACKGROUNDS,
    }).toEqual({
      animals: manifest.animals.map((animal) => animal.id),
      accessories: manifest.accessories.map((accessory) => accessory.id),
      backgrounds: manifest.backgrounds,
    });
  });
});
