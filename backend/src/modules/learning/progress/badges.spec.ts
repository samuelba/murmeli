import { BADGES, BADGE_IDS, earnedBadges, isBadgeId } from './badges';

const none = {
  passedLevels: 0,
  completedWorlds: 0,
  threeStarLevels: 0,
  practiced: false,
};

describe('earnedBadges', () => {
  it('earns nothing at the start', () => {
    expect(earnedBadges(none)).toEqual([]);
  });

  it('earns each badge from its own milestone', () => {
    expect(earnedBadges({ ...none, passedLevels: 1 })).toEqual(['first-level']);
    expect(earnedBadges({ ...none, completedWorlds: 1 })).toEqual([
      'first-world',
    ]);
    expect(earnedBadges({ ...none, threeStarLevels: 4 })).toEqual([]);
    expect(earnedBadges({ ...none, threeStarLevels: 5 })).toEqual([
      'star-collector',
    ]);
    expect(earnedBadges({ ...none, practiced: true })).toEqual([
      'first-practice',
    ]);
  });

  it('has a title in both languages for every badge, without ß', () => {
    for (const id of BADGE_IDS) {
      expect(BADGES[id].title['de-CH']).toBeTruthy();
      expect(BADGES[id].title['en-US']).toBeTruthy();
      expect(BADGES[id].title['de-CH']).not.toContain('ß');
    }
  });

  it('recognizes badge ids', () => {
    expect(isBadgeId('first-level')).toBe(true);
    expect(isBadgeId('toString')).toBe(false);
  });
});
