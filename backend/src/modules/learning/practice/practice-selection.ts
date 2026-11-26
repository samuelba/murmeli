import { type Level, createRng } from '@murmeli/content';
import { PRACTICE_SKILLS, PRACTICE_TARGET_ITEMS } from '../learning.constants';

export interface SkillRecord {
  readonly skillId: string;
  readonly mastery: number;
  readonly nextReviewAt: Date;
  readonly updatedAt: Date;
}

export interface PracticeSlot {
  readonly index: number;
  readonly skillId: string;
  readonly level: Level;
}

function byDue(a: SkillRecord, b: SkillRecord): number {
  return (
    a.nextReviewAt.getTime() - b.nextReviewAt.getTime() ||
    a.mastery - b.mastery ||
    b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}

function byWeakest(a: SkillRecord, b: SkillRecord): number {
  return (
    a.mastery - b.mastery ||
    b.updatedAt.getTime() - a.updatedAt.getTime() ||
    a.nextReviewAt.getTime() - b.nextReviewAt.getTime()
  );
}

/**
 * Contract §3.5: among the skills of open levels, the played skills that are
 * due (earliest review first), then the skills never played (in map order,
 * they have no mastery yet), then the weakest; ties go to the most recently
 * played.
 */
export function selectPracticeSkills(
  openSkills: readonly string[],
  records: readonly SkillRecord[],
  now: Date,
  max: number = PRACTICE_SKILLS,
): string[] {
  const open = new Set(openSkills);
  const played = records.filter((record) => open.has(record.skillId));
  const playedIds = new Set(played.map((record) => record.skillId));
  const due = played.filter((r) => r.nextReviewAt.getTime() <= now.getTime());
  const later = played.filter((r) => r.nextReviewAt.getTime() > now.getTime());
  return [
    ...due.sort(byDue).map((record) => record.skillId),
    ...[...open].filter((skillId) => !playedIds.has(skillId)),
    ...later.sort(byWeakest).map((record) => record.skillId),
  ].slice(0, max);
}

export function practiceItemCount(skills: number): number {
  return skills === 0 ? 0 : skills * Math.ceil(PRACTICE_TARGET_ITEMS / skills);
}

/**
 * Interleaves the skills and picks one of the skill's open levels per item,
 * deterministically from the run seed.
 */
export function planPractice(
  skills: readonly string[],
  levelsBySkill: ReadonlyMap<string, readonly Level[]>,
  seed: number,
): PracticeSlot[] {
  const usable = skills.flatMap((skillId) => {
    const levels = levelsBySkill.get(skillId) ?? [];
    return levels.length > 0 ? [{ skillId, levels }] : [];
  });
  const rng = createRng(seed);
  return Array.from({ length: practiceItemCount(usable.length) }, (_, i) => {
    const { skillId, levels } = usable[i % usable.length];
    return { index: i, skillId, level: rng.pick(levels) };
  });
}
