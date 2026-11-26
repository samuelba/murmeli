import { Language } from '../i18n/languages';
import manifest from './avatar-manifest.json';

export interface Avatar {
  readonly animal: string;
  readonly accessory: string | null;
  readonly background: string;
}

export interface AvatarPart {
  readonly id: string;
  readonly file: string;
  readonly name: Readonly<Record<Language, string>>;
}

const BASE = '/brand/avatars/';

export const AVATAR_ANIMALS: readonly AvatarPart[] = manifest.animals;
export const AVATAR_ACCESSORIES: readonly AvatarPart[] = manifest.accessories;
export const AVATAR_BACKGROUNDS: readonly string[] = manifest.backgrounds;

export const DEFAULT_AVATAR: Avatar = {
  animal: AVATAR_ANIMALS[0].id,
  accessory: null,
  background: AVATAR_BACKGROUNDS[0],
};

export function animalUrl(id: string): string | null {
  const part = AVATAR_ANIMALS.find((animal) => animal.id === id);
  return part ? BASE + part.file : null;
}

export function accessoryUrl(id: string | null): string | null {
  const part = AVATAR_ACCESSORIES.find((accessory) => accessory.id === id);
  return part ? BASE + part.file : null;
}

export function partName(part: AvatarPart, language: Language): string {
  return part.name[language];
}

export function animalName(id: string, language: Language): string {
  const part = AVATAR_ANIMALS.find((animal) => animal.id === id);
  return part ? partName(part, language) : id;
}

export function isValidAvatar(avatar: Avatar): boolean {
  return (
    AVATAR_ANIMALS.some((animal) => animal.id === avatar.animal) &&
    (avatar.accessory === null ||
      AVATAR_ACCESSORIES.some((accessory) => accessory.id === avatar.accessory)) &&
    AVATAR_BACKGROUNDS.includes(avatar.background)
  );
}

export function randomAvatar(random: () => number = Math.random): Avatar {
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  return { animal: pick(AVATAR_ANIMALS).id, accessory: null, background: pick(AVATAR_BACKGROUNDS) };
}

/**
 * The nine pictures of the 3×3 picture-PIN grid; a PIN digit is the index into this list.
 * Chosen to look clearly different and to have names young kids know in both languages.
 */
export const PIN_PICTURE_IDS = [
  'cow',
  'fox',
  'owl',
  'frog',
  'penguin',
  'cat',
  'pig',
  'lion',
  'elephant',
] as const;
export const PIN_PICTURES: readonly AvatarPart[] = PIN_PICTURE_IDS.map((id) => {
  const part = AVATAR_ANIMALS.find((animal) => animal.id === id);
  if (!part) {
    throw new Error(`PIN picture ${id} is missing from the avatar manifest`);
  }
  return part;
});
export const PIN_LENGTH = 4;

export function pinPictureUrl(index: number): string {
  return BASE + PIN_PICTURES[index].file;
}
