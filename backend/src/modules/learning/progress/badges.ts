import type { LocalizedText } from '@murmeli/content';

export const BADGES = {
  'first-level': {
    title: { 'de-CH': 'Erster Wegweiser', 'en-US': 'First Signpost' },
  },
  'first-world': {
    title: { 'de-CH': 'Erste Gipfelfahne', 'en-US': 'First Summit Flag' },
  },
  'star-collector': {
    title: { 'de-CH': 'Sternensammler', 'en-US': 'Star Collector' },
  },
  'first-practice': {
    title: { 'de-CH': 'Erste Übung', 'en-US': 'First Practice' },
  },
} as const satisfies Record<string, { readonly title: LocalizedText }>;

export type BadgeId = keyof typeof BADGES;
export const BADGE_IDS = Object.keys(BADGES) as BadgeId[];

export const STAR_COLLECTOR_LEVELS = 5;

export interface BadgeStats {
  readonly passedLevels: number;
  readonly completedWorlds: number;
  readonly threeStarLevels: number;
  readonly practiced: boolean;
}

/**
 * Badges reward what a kid has done; they are never taken away and nothing
 * depends on streaks or daily visits.
 */
export function earnedBadges(stats: BadgeStats): BadgeId[] {
  const earned: Record<BadgeId, boolean> = {
    'first-level': stats.passedLevels >= 1,
    'first-world': stats.completedWorlds >= 1,
    'star-collector': stats.threeStarLevels >= STAR_COLLECTOR_LEVELS,
    'first-practice': stats.practiced,
  };
  return BADGE_IDS.filter((id) => earned[id]);
}

export function isBadgeId(id: string): id is BadgeId {
  return Object.hasOwn(BADGES, id);
}
