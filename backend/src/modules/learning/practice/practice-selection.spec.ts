import type { Level } from '@murmeli/content';
import {
  type SkillRecord,
  planPractice,
  practiceItemCount,
  selectPracticeSkills,
} from './practice-selection';

const NOW = new Date('2026-05-10T08:00:00Z');
const at = (iso: string) => new Date(iso);

function record(
  skillId: string,
  mastery: number,
  nextReviewAt: string,
  updatedAt = '2026-05-01T00:00:00Z',
): SkillRecord {
  return {
    skillId,
    mastery,
    nextReviewAt: at(nextReviewAt),
    updatedAt: at(updatedAt),
  };
}

describe('selectPracticeSkills', () => {
  const open = ['a', 'b', 'c', 'd', 'e'];

  it('takes due skills first, earliest review first', () => {
    const records = [
      record('a', 0.2, '2026-05-20T00:00:00Z'),
      record('b', 0.9, '2026-05-09T00:00:00Z'),
      record('c', 0.8, '2026-05-01T00:00:00Z'),
      record('d', 0.1, '2026-05-30T00:00:00Z'),
    ];
    expect(selectPracticeSkills(open, records, NOW)).toEqual(['c', 'b', 'e']);
  });

  it('breaks ties by lower mastery, then by most recent play', () => {
    const records = [
      record('a', 0.5, '2026-05-20T00:00:00Z', '2026-05-01T00:00:00Z'),
      record('b', 0.5, '2026-05-20T00:00:00Z', '2026-05-05T00:00:00Z'),
      record('c', 0.3, '2026-05-25T00:00:00Z'),
      record('d', 0.4, '2026-05-05T00:00:00Z'),
      record('e', 0.2, '2026-05-05T00:00:00Z'),
    ];
    expect(selectPracticeSkills(open, records, NOW, 5)).toEqual([
      'e',
      'd',
      'c',
      'b',
      'a',
    ]);
  });

  it('puts never-played skills after the due ones and before the weakest', () => {
    const records = [
      record('a', 0.1, '2026-05-20T00:00:00Z'),
      record('b', 0.9, '2026-05-01T00:00:00Z'),
    ];
    expect(selectPracticeSkills(open, records, NOW, 5)).toEqual([
      'b',
      'c',
      'd',
      'e',
      'a',
    ]);
  });

  it('ignores skills of levels that are not open', () => {
    const records = [record('z', 0, '2026-05-01T00:00:00Z')];
    expect(selectPracticeSkills(['a', 'b'], records, NOW)).toEqual(['a', 'b']);
  });

  it('falls back to the first open skills before anything was played', () => {
    expect(selectPracticeSkills(open, [], NOW)).toEqual(['a', 'b', 'c']);
    expect(selectPracticeSkills([], [], NOW)).toEqual([]);
  });
});

describe('planPractice', () => {
  const level = (id: string, skill: string) => ({ id, skill }) as Level;
  const levels = new Map<string, Level[]>([
    ['a', [level('a-1', 'a'), level('a-2', 'a')]],
    ['b', [level('b-1', 'b')]],
    ['c', [level('c-1', 'c')]],
  ]);

  it('builds 8 to 10 items', () => {
    expect([1, 2, 3].map(practiceItemCount)).toEqual([9, 10, 9]);
    expect(practiceItemCount(0)).toBe(0);
  });

  it('interleaves the skills and only uses their open levels', () => {
    const plan = planPractice(['a', 'b', 'c'], levels, 42);
    expect(plan).toHaveLength(9);
    expect(plan.map((slot) => slot.skillId).slice(0, 6)).toEqual([
      'a',
      'b',
      'c',
      'a',
      'b',
      'c',
    ]);
    expect(plan.map((slot) => slot.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (const slot of plan) {
      expect(slot.level.skill).toBe(slot.skillId);
    }
  });

  it('is deterministic per seed and skips skills without levels', () => {
    expect(planPractice(['a', 'x'], levels, 7)).toEqual(
      planPractice(['a', 'x'], levels, 7),
    );
    expect(planPractice(['x'], levels, 7)).toEqual([]);
  });
});
