import { Injectable } from '@nestjs/common';
import {
  type FinishRunResponse,
  type LevelRef,
  type MapResponse,
  isPassed,
  starsFor,
} from '@murmeli/content';
import type { EntityManager } from 'typeorm';
import type { KidEntity } from '../../kids/kid.entity';
import { Curriculum } from '../content/curriculum';
import { PRACTICE_PASS_RATIO } from '../learning.constants';
import {
  dailyLimitReached,
  levelLocked,
  levelNotFound,
} from '../learning.errors';
import { LearningSettings } from '../learning.settings';
import type { RunState, RunSummary } from '../runs/run-state';
import { activeSeconds } from '../runs/run-state';
import { localDay } from '../time/local-day';
import { earnedBadges } from './badges';
import { buildMap } from './map-builder';
import { nextMastery } from './mastery';
import {
  type LevelProgressRow,
  type MasteryRow,
  ProgressStore,
} from './progress.store';
import {
  type ProgressStates,
  computeStates,
  isOpen,
  unlockAll,
  unlockedBetween,
} from './unlock';

export type LearningKid = Pick<
  KidEntity,
  'id' | 'language' | 'startClass' | 'dailyLimitMinutes'
>;

export interface LevelAccess {
  readonly ref: LevelRef;
  readonly demoSeen: boolean;
}

export interface KidProgress {
  readonly rows: readonly LevelProgressRow[];
  readonly lookup: ReadonlyMap<string, LevelProgressRow>;
  readonly states: ProgressStates;
}

function lookupOf(
  rows: readonly LevelProgressRow[],
): ReadonlyMap<string, LevelProgressRow> {
  return new Map(rows.map((row) => [row.levelId, row]));
}

/**
 * Progress of a kid: the map, unlocking, the daily limit, and what a
 * finished run changes (contract §3).
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly curriculum: Curriculum,
    private readonly store: ProgressStore,
    private readonly settings: LearningSettings,
  ) {}

  today(now: Date): string {
    return localDay(now, this.settings.timeZone);
  }

  statesOf(kid: LearningKid, rows: readonly LevelProgressRow[]): KidProgress {
    const lookup = lookupOf(rows);
    const states = computeStates(
      this.curriculum.worlds,
      kid.startClass,
      lookup,
    );
    return {
      rows,
      lookup,
      states: this.settings.unlockAll ? unlockAll(states) : states,
    };
  }

  async progressOf(kid: LearningKid): Promise<KidProgress> {
    return this.statesOf(kid, await this.store.levels(kid.id));
  }

  async map(kid: LearningKid): Promise<MapResponse> {
    const [{ lookup, states }, badges] = await Promise.all([
      this.progressOf(kid),
      this.store.badges(kid.id),
    ]);
    return buildMap(
      this.curriculum.tracksFor(kid.language),
      kid.language,
      states,
      lookup,
      badges.map((badge) => badge.badgeId),
    );
  }

  async levelAccess(kid: LearningKid, levelId: string): Promise<LevelAccess> {
    const ref = this.curriculum.levelFor(levelId, kid.language);
    if (!ref) {
      throw levelNotFound();
    }
    const { lookup, states } = await this.progressOf(kid);
    if (!isOpen(states.levels.get(levelId))) {
      throw levelLocked();
    }
    return { ref, demoSeen: lookup.get(levelId)?.demoSeen === true };
  }

  markDemoSeen(kid: LearningKid, levelId: string): Promise<void> {
    return this.store.markDemoSeen(kid.id, levelId);
  }

  async assertWithinDailyLimit(kid: LearningKid, now: Date): Promise<void> {
    if (kid.dailyLimitMinutes === null) {
      return;
    }
    const seconds = await this.store.secondsOn(kid.id, this.today(now));
    if (seconds >= kid.dailyLimitMinutes * 60) {
      throw dailyLimitReached();
    }
  }

  /** An abandoned run still counts its answer time towards the day. */
  async recordAbandoned(state: RunState, now: Date): Promise<void> {
    const seconds = activeSeconds(state, now.getTime(), false);
    if (seconds > 0) {
      await this.store.addActivity(state.kidId, this.today(now), seconds, 0);
    }
  }

  async finish(
    kid: LearningKid,
    state: RunState,
    summary: RunSummary,
    now: Date,
  ): Promise<FinishRunResponse> {
    const level =
      state.levelId === null
        ? undefined
        : this.curriculum.content.index.levels[state.levelId]?.level;
    const stars = starsFor(
      summary.score,
      level?.passRatio ?? PRACTICE_PASS_RATIO,
    );
    const passed = level !== undefined && isPassed(stars);
    return this.store.transaction(async (db) => {
      await this.store.lockKid(kid.id, db);
      const before = this.statesOf(kid, await this.store.levels(kid.id, db));
      if (level) {
        await this.store.recordLevel(
          kid.id,
          { levelId: level.id, stars, score: summary.score, passed },
          db,
        );
      }
      await this.updateMastery(kid.id, summary, now, db);
      await this.store.addActivity(
        kid.id,
        this.today(now),
        summary.activeSeconds,
        1,
        db,
      );
      const after = this.statesOf(kid, await this.store.levels(kid.id, db));
      const newBadges = await this.store.awardBadges(
        kid.id,
        this.badgesFor(
          kid,
          after,
          state.mode === 'practice' &&
            state.items.some((item) => item.attempts > 0),
        ),
        db,
      );
      return {
        score: summary.score,
        stars,
        passed,
        unlocked: this.visibleUnlocks(kid, before.states, after.states),
        newBadges,
      };
    });
  }

  private async updateMastery(
    kidId: string,
    summary: RunSummary,
    now: Date,
    db: EntityManager,
  ): Promise<void> {
    const previous = new Map<string, MasteryRow>(
      (await this.store.mastery(kidId, db)).map((row) => [row.skillId, row]),
    );
    for (const [skillId, score] of summary.skillScores) {
      await this.store.saveMastery(
        kidId,
        skillId,
        nextMastery(previous.get(skillId), score, now),
        db,
      );
    }
  }

  private badgesFor(
    kid: LearningKid,
    progress: KidProgress,
    practiced: boolean,
  ): string[] {
    const worlds = this.curriculum.worldsFor(kid.language);
    return earnedBadges({
      passedLevels: progress.rows.filter((row) => row.passed).length,
      threeStarLevels: progress.rows.filter((row) => row.stars === 3).length,
      completedWorlds: worlds.filter(
        (world) => progress.states.worlds.get(world.id) === 'passed',
      ).length,
      practiced,
    });
  }

  private visibleUnlocks(
    kid: LearningKid,
    before: ProgressStates,
    after: ProgressStates,
  ): FinishRunResponse['unlocked'] {
    const unlocked = unlockedBetween(before, after);
    const worlds = this.curriculum.worldsFor(kid.language);
    const worldIds = new Set(worlds.map((world) => world.id));
    const levelIds = new Set(
      worlds.flatMap((world) => world.levels.map((level) => level.id)),
    );
    return {
      levels: unlocked.levels.filter((id) => levelIds.has(id)),
      worlds: unlocked.worlds.filter((id) => worldIds.has(id)),
    };
  }
}
