import type {
  Locale,
  MapResponse,
  MapWorld,
  Stars,
  Track,
} from '@murmeli/content';
import { localize } from '../content/curriculum';
import type { ProgressLookup, ProgressStates } from './unlock';

export const STARS_PER_LEVEL = 3;

function starsOf(progress: ProgressLookup, levelId: string): Stars {
  return progress.get(levelId)?.stars ?? 0;
}

/**
 * The kid's trail map: their tracks, then worlds, then levels, with states
 * and stars, localized to the kid's language, plus their earned badge ids.
 */
export function buildMap(
  tracks: readonly Track[],
  locale: Locale,
  states: ProgressStates,
  progress: ProgressLookup,
  badges: readonly string[] = [],
): MapResponse {
  return {
    badges: [...badges],
    tracks: tracks.map((track) => ({
      id: track.id,
      title: localize(track.title, locale),
      icon: track.icon,
      worlds: track.worlds.map((world): MapWorld => {
        const levels = world.levels.map((level) => ({
          id: level.id,
          title: localize(level.title, locale),
          state: states.levels.get(level.id) ?? 'locked',
          stars: starsOf(progress, level.id),
        }));
        return {
          id: world.id,
          title: localize(world.title, locale),
          scene: world.scene,
          grade: world.grade,
          state: states.worlds.get(world.id) ?? 'locked',
          stars: levels.reduce((sum, level) => sum + level.stars, 0),
          maxStars: levels.length * STARS_PER_LEVEL,
          levels,
        };
      }),
    })),
  };
}
