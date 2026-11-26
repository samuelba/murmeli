import { Injectable } from '@nestjs/common';
import type { Locale } from '@murmeli/content';
import { KidsService } from '../../kids/kids.service';
import { Curriculum, localize } from '../content/curriculum';
import {
  ACTIVITY_DAYS,
  WEAK_MASTERY,
  WEAK_SKILLS_MAX,
} from '../learning.constants';
import { LearningSettings } from '../learning.settings';
import { BADGES, isBadgeId } from '../progress/badges';
import { buildMap } from '../progress/map-builder';
import { ProgressService } from '../progress/progress.service';
import {
  type ActivityRow,
  type MasteryRow,
  ProgressStore,
} from '../progress/progress.store';
import { recentDays } from '../time/local-day';
import type {
  ParentActivityDay,
  ParentProgressResponse,
  ParentProgressTrack,
  ParentSkillMastery,
} from './parent-progress.types';

const DAY_MS = 24 * 3600 * 1000;

/**
 * The parent dashboard for one of the parent's own kids.
 */
@Injectable()
export class ParentProgressService {
  constructor(
    private readonly kids: KidsService,
    private readonly curriculum: Curriculum,
    private readonly progress: ProgressService,
    private readonly store: ProgressStore,
    private readonly settings: LearningSettings,
  ) {}

  async forKid(
    userId: string,
    kidId: string,
    now = new Date(),
  ): Promise<ParentProgressResponse> {
    const kid = await this.kids.requireOwned(userId, kidId);
    const locale = kid.language;
    const days = recentDays(now, this.settings.timeZone, ACTIVITY_DAYS);
    const [progress, mastery, activity, badges] = await Promise.all([
      this.progress.progressOf(kid),
      this.store.mastery(kid.id),
      this.store.activity(kid.id, days[0]),
      this.store.badges(kid.id),
    ]);
    const skills = mastery.map((row) => this.skillView(row, locale));
    const recent = now.getTime() - ACTIVITY_DAYS * DAY_MS;
    return {
      kidId: kid.id,
      locale,
      tracks: this.tracks(locale, progress),
      skills,
      activity: this.activity(days, activity),
      weakSkills: skills
        .filter(
          (skill) =>
            skill.mastery < WEAK_MASTERY &&
            Date.parse(skill.lastPracticedAt) >= recent,
        )
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, WEAK_SKILLS_MAX),
      badges: badges
        .filter((row) => isBadgeId(row.badgeId))
        .map((row) => ({
          id: row.badgeId,
          title: localize(
            BADGES[row.badgeId as keyof typeof BADGES].title,
            locale,
          ),
          earnedAt: row.earnedAt.toISOString(),
        })),
    };
  }

  private tracks(
    locale: Locale,
    progress: Awaited<ReturnType<ProgressService['progressOf']>>,
  ): ParentProgressTrack[] {
    const rows = new Map(progress.rows.map((row) => [row.levelId, row]));
    const map = buildMap(
      this.curriculum.tracksFor(locale),
      locale,
      progress.states,
      progress.lookup,
    );
    return map.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      worlds: track.worlds.map((world) => ({
        id: world.id,
        title: world.title,
        grade: world.grade,
        state: world.state,
        stars: world.stars,
        maxStars: world.maxStars,
        levels: world.levels.map((level) => {
          const row = rows.get(level.id);
          return {
            ...level,
            bestScore: row?.bestScore ?? 0,
            runs: row?.runs ?? 0,
            firstPassedAt: row?.firstPassedAt?.toISOString() ?? null,
          };
        }),
      })),
    }));
  }

  private skillView(row: MasteryRow, locale: Locale): ParentSkillMastery {
    const ref = this.curriculum.skill(row.skillId);
    return {
      id: row.skillId,
      title: ref ? localize(ref.skill.title, locale) : row.skillId,
      trackId: ref?.trackId ?? null,
      worldId: ref?.worldId ?? null,
      mastery: row.mastery,
      box: row.box,
      nextReviewAt: row.nextReviewAt.toISOString(),
      lastPracticedAt: row.updatedAt.toISOString(),
    };
  }

  private activity(
    days: readonly string[],
    rows: readonly ActivityRow[],
  ): ParentActivityDay[] {
    const byDay = new Map(rows.map((row) => [row.day, row]));
    return days.map((day) => {
      const row = byDay.get(day);
      return {
        day,
        minutes: Math.ceil((row?.seconds ?? 0) / 60),
        runs: row?.runs ?? 0,
      };
    });
  }
}
