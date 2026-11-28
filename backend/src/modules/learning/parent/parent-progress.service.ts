import { Injectable } from '@nestjs/common';
import {
  type Locale,
  PRACTICE_TOPIC_TITLES,
  answerText,
  regenerateExercise,
  spokenQuestion,
} from '@murmeli/content';
import { KidsService } from '../../kids/kids.service';
import { Curriculum, localize } from '../content/curriculum';
import {
  ACTIVITY_DAYS,
  PARENT_MISTAKES_PER_TOPIC,
  WEAK_MASTERY,
  WEAK_SKILLS_MAX,
} from '../learning.constants';
import { LearningSettings } from '../learning.settings';
import { levelOf } from '../practice/adaptive';
import {
  type TopicStanding,
  PracticeService,
} from '../practice/practice.service';
import {
  type PracticeDayRow,
  type ReviewRow,
  PracticeStore,
} from '../practice/practice.store';
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
  ParentPractice,
  ParentPracticeMistake,
  ParentPracticeTopic,
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
    private readonly practiceService: PracticeService,
    private readonly practiceStore: PracticeStore,
  ) {}

  async forKid(
    userId: string,
    kidId: string,
    now = new Date(),
  ): Promise<ParentProgressResponse> {
    const kid = await this.kids.requireOwned(userId, kidId);
    const locale = kid.language;
    const days = recentDays(now, this.settings.timeZone, ACTIVITY_DAYS);
    const [progress, mastery, activity, badges, practice] = await Promise.all([
      this.progress.progressOf(kid),
      this.store.mastery(kid.id),
      this.store.activity(kid.id, days[0]),
      this.store.badges(kid.id),
      this.practice(kid, days),
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
      practice,
    };
  }

  private async practice(
    kid: Awaited<ReturnType<KidsService['requireOwned']>>,
    days: readonly string[],
  ): Promise<ParentPractice> {
    const [standings, reviews, daily] = await Promise.all([
      this.practiceService.standings(kid),
      this.practiceStore.reviews(kid.id, kid.language),
      this.practiceStore.daily(kid.id, days[0]),
    ]);
    const topics = [...standings.values()]
      .map((standing, order) => ({
        order,
        view: this.practiceTopic(
          standing,
          reviews.filter((row) => row.topicId === standing.ladder.topic),
          daily.filter((row) => row.topicId === standing.ladder.topic),
          kid.language,
        ),
      }))
      .filter(({ view }) => view.runs > 0 || view.openMistakes > 0)
      .sort(
        (a, b) =>
          (b.view.lastPracticedAt ?? '').localeCompare(
            a.view.lastPracticedAt ?? '',
          ) ||
          b.view.openMistakes - a.view.openMistakes ||
          a.order - b.order,
      )
      .map(({ view }) => view);
    return {
      topics,
      days: days.map((day) => {
        const rows = daily.filter((row) => row.day === day);
        return {
          day,
          items: rows.reduce((sum, row) => sum + row.items, 0),
          firstTry: rows.reduce((sum, row) => sum + row.firstTry, 0),
        };
      }),
    };
  }

  private practiceTopic(
    standing: TopicStanding,
    reviews: readonly ReviewRow[],
    daily: readonly PracticeDayRow[],
    locale: Locale,
  ): ParentPracticeTopic {
    const record = standing.record;
    return {
      id: standing.ladder.topic,
      title: localize(PRACTICE_TOPIC_TITLES[standing.ladder.topic], locale),
      trackId: standing.ladder.trackId,
      state: standing.reach.state,
      level: levelOf(standing.rating, standing.reach),
      maxLevel: standing.reach.maxStep + 1,
      levels: standing.ladder.steps.length,
      runs: record?.runs ?? 0,
      items: record?.items ?? 0,
      firstTry: record?.firstTry ?? 0,
      recentItems: daily.reduce((sum, row) => sum + row.items, 0),
      recentFirstTry: daily.reduce((sum, row) => sum + row.firstTry, 0),
      lastPracticedAt: record?.lastPracticedAt?.toISOString() ?? null,
      openMistakes: reviews.length,
      mistakes: reviews
        .flatMap((row) => this.mistake(row, locale))
        .slice(0, PARENT_MISTAKES_PER_TOPIC),
    };
  }

  private mistake(row: ReviewRow, locale: Locale): ParentPracticeMistake[] {
    let exercise;
    try {
      exercise = regenerateExercise(
        this.curriculum.content.index.levels,
        row.source,
        { locale, content: this.curriculum.content },
      );
    } catch {
      return [];
    }
    return exercise === undefined
      ? []
      : [
          {
            question: spokenQuestion(exercise.prompt.speak),
            answer: answerText(
              exercise,
              this.curriculum.content.pictures,
              locale,
            ),
            misses: row.misses,
            dueAt: row.dueAt.toISOString(),
          },
        ];
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
