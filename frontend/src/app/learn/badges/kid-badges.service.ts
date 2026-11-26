import { Injectable, inject } from '@angular/core';
import { SafeStorage } from '../../core/storage/safe-storage';
import { MapResponse } from '../learn.models';
import { BadgeId, badgesFromMap, knownBadges } from './badges';

export const BADGE_STORAGE_KEY = 'mu-badges';

/**
 * The kid's earned badges. The map lists them (`badges`, the same on every device). Older
 * backends don't, so then what the map proves plus the `newBadges` of finished runs, kept on
 * this device (only badge ids), stand in for it.
 */
@Injectable({ providedIn: 'root' })
export class KidBadges {
  private readonly storage = inject(SafeStorage);

  remember(kidId: string, ids: readonly string[]): void {
    const fresh = knownBadges(ids);
    if (fresh.length > 0) {
      this.storage.set(
        this.key(kidId),
        JSON.stringify(knownBadges([...this.stored(kidId), ...fresh])),
      );
    }
  }

  earned(kidId: string, map: MapResponse): BadgeId[] {
    if (map.badges) {
      return knownBadges(map.badges);
    }
    return knownBadges([...badgesFromMap(map), ...this.stored(kidId)]);
  }

  private stored(kidId: string): BadgeId[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.get(this.key(kidId)) ?? '[]');
      return Array.isArray(parsed)
        ? knownBadges(parsed.filter((id) => typeof id === 'string'))
        : [];
    } catch {
      return [];
    }
  }

  private key(kidId: string): string {
    return `${BADGE_STORAGE_KEY}:${kidId}`;
  }
}
