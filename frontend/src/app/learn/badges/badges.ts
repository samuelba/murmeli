import { MapResponse } from '../learn.models';
import { worldComplete } from '../map/trail-layout';

/** The badges of docs/internal/learning-engine.md §7, in shelf order. */
export const BADGE_IDS = [
  'first-level',
  'first-world',
  'star-collector',
  'first-practice',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export const STAR_COLLECTOR_LEVELS = 5;

const NAME_KEYS: Readonly<Record<BadgeId, string>> = {
  'first-level': 'kid.badges.firstLevel',
  'first-world': 'kid.badges.firstWorld',
  'star-collector': 'kid.badges.starCollector',
  'first-practice': 'kid.badges.firstPractice',
};

export function isBadgeId(id: string): id is BadgeId {
  return (BADGE_IDS as readonly string[]).includes(id);
}

/** Spoken name (kid.badges.*, no placeholders, so it has a pre-rendered clip). */
export function badgeNameKey(id: BadgeId): string {
  return NAME_KEYS[id];
}

/** How to earn it, spoken too. */
export function badgeHintKey(id: BadgeId): string {
  return `${NAME_KEYS[id]}Hint`;
}

/** Known ids only, without duplicates, in shelf order (a newer server may send more). */
export function knownBadges(ids: Iterable<string>): BadgeId[] {
  const set = new Set(ids);
  return BADGE_IDS.filter((id) => set.has(id));
}

/** A map response that may already list the kid's badges (newer backends). */
export type MapWithBadges = MapResponse & { readonly badges?: readonly string[] };

/** What the trail map itself proves; first-practice is only known from a finished run. */
export function badgesFromMap(map: MapWithBadges): BadgeId[] {
  const worlds = map.tracks.flatMap((track) => track.worlds);
  const levels = worlds.flatMap((world) => world.levels);
  const earned: string[] = [...(map.badges ?? [])];
  if (levels.some((level) => level.state === 'passed')) {
    earned.push('first-level');
  }
  if (worlds.some((world) => world.levels.length > 0 && worldComplete(world))) {
    earned.push('first-world');
  }
  if (levels.filter((level) => level.stars === 3).length >= STAR_COLLECTOR_LEVELS) {
    earned.push('star-collector');
  }
  return knownBadges(earned);
}
