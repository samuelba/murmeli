import {
  AVATAR_ACCESSORIES,
  AVATAR_ANIMALS,
  AVATAR_BACKGROUNDS,
} from './avatar-catalog';
import type { Avatar } from './kid.types';

/**
 * @returns the avatar with the background in its catalog spelling, or null
 * if any part is not in the catalog
 */
export function canonicalAvatar(avatar: Avatar): Avatar | null {
  const background = AVATAR_BACKGROUNDS.find(
    (color) => color.toLowerCase() === avatar.background.toLowerCase(),
  );
  const accessoryOk =
    avatar.accessory === null || AVATAR_ACCESSORIES.includes(avatar.accessory);
  if (!AVATAR_ANIMALS.includes(avatar.animal) || !accessoryOk || !background) {
    return null;
  }
  return { animal: avatar.animal, accessory: avatar.accessory, background };
}
