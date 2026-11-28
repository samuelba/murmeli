import { Injectable, Logger } from '@nestjs/common';
import {
  type GeneratedItem,
  type Level,
  type PracticeCatalogResponse,
  type PracticeLadder,
  type PracticeRunInfo,
  type PracticeTopicId,
  type PracticeTopicView,
  type PublicDemo,
  PRACTICE_TOPIC_TITLES,
  createRng,
  exerciseKey,
  generateDemo,
  generatePracticeItem,
  mixSeed,
  practiceDemoLevel,
  regenerateExercise,
  toPublicDemo,
} from '@murmeli/content';
import { errorMessage } from '../../../common/errors/error-message';
import { Curriculum, localize } from '../content/curriculum';
import {
  PRACTICE_MAX_REVIEWS,
  PRACTICE_MIX_ITEMS_PER_TOPIC,
  PRACTICE_MIX_TOPICS,
  PRACTICE_TOPIC_ITEMS,
} from '../learning.constants';
import {
  nothingToPractice,
  topicLocked,
  topicNotFound,
} from '../learning.errors';
import {
  type LearningKid,
  ProgressService,
} from '../progress/progress.service';
import type { PracticeTopicStart, RunItem, RunState } from '../runs/run-state';
import {
  type TopicReach,
  interleave,
  levelOf,
  mixPriority,
  planSteps,
  startRating,
  stepOf,
  topicReach,
  worldsAhead,
} from './adaptive';
import {
  type ReviewRow,
  type TopicProgressRow,
  PracticeStore,
} from './practice.store';

/** One topic as the kid can practice it right now. */
export interface TopicStanding {
  readonly ladder: PracticeLadder;
  readonly reach: TopicReach;
  readonly record: TopicProgressRow | undefined;
  /** The rating the next run starts from */
  readonly rating: number;
}

export interface PracticePlan {
  readonly topicId: PracticeTopicId | null;
  readonly items: readonly RunItem[];
  readonly starts: readonly PracticeTopicStart[];
  readonly info: PracticeRunInfo;
  readonly demo?: PublicDemo;
  readonly demoSeen: boolean;
}

/**
 * The practice ground (contract §3.5): what a kid may practice, and runs on
 * one topic or "Murmeli wählt" with the kid's adaptive step and earlier
 * mistakes mixed in.
 */
@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);

  constructor(
    private readonly curriculum: Curriculum,
    private readonly progress: ProgressService,
    private readonly store: PracticeStore,
  ) {}

  async standings(
    kid: LearningKid,
  ): Promise<Map<PracticeTopicId, TopicStanding>> {
    const [{ states }, records] = await Promise.all([
      this.progress.progressOf(kid),
      this.store.topics(kid.id),
    ]);
    const byTopic = new Map(records.map((record) => [record.topicId, record]));
    const ahead = worldsAhead(this.curriculum.worldsFor(kid.language), states);
    return new Map(
      this.curriculum.practiceLadders(kid.language).map((ladder) => {
        const reach = topicReach(ladder, states, ahead);
        const record = byTopic.get(ladder.topic);
        return [
          ladder.topic,
          { ladder, reach, record, rating: startRating(record, reach) },
        ];
      }),
    );
  }

  async catalog(
    kid: LearningKid,
    now = new Date(),
  ): Promise<PracticeCatalogResponse> {
    const [standings, counts] = await Promise.all([
      this.standings(kid),
      this.store.reviewCounts(kid.id, kid.language, now),
    ]);
    const due = new Map(counts.map((count) => [count.topicId, count.due]));
    const views = [...standings.values()].map(
      (standing): PracticeTopicView & { trackId: string } => ({
        id: standing.ladder.topic,
        trackId: standing.ladder.trackId,
        title: localize(
          PRACTICE_TOPIC_TITLES[standing.ladder.topic],
          kid.language,
        ),
        state: standing.reach.state,
        level: levelOf(standing.rating, standing.reach),
        maxLevel: standing.reach.maxStep + 1,
        levels: standing.ladder.steps.length,
        dueReviews:
          standing.reach.state === 'locked'
            ? 0
            : (due.get(standing.ladder.topic) ?? 0),
        practiced: (standing.record?.runs ?? 0) > 0,
      }),
    );
    const open = views.filter((view) => view.state === 'open');
    return {
      tracks: this.curriculum.tracksFor(kid.language).flatMap((track) => {
        const topics = views
          .filter((view) => view.trackId === track.id)
          .map(({ trackId: _trackId, ...view }) => view);
        return topics.length === 0
          ? []
          : [
              {
                id: track.id,
                title: localize(track.title, kid.language),
                icon: track.icon,
                topics,
              },
            ];
      }),
      mix: {
        available: open.length > 0,
        dueReviews: open.reduce((sum, view) => sum + view.dueReviews, 0),
      },
    };
  }

  /** A run on one topic, or "Murmeli wählt" when `topic` is null. */
  async plan(
    kid: LearningKid,
    topic: PracticeTopicId | null,
    seed: number,
    now: Date,
  ): Promise<PracticePlan> {
    const standings = await this.standings(kid);
    return topic === null
      ? this.planMix(kid, standings, seed, now)
      : this.planTopic(kid, standings, topic, seed, now);
  }

  /** The step and demo of a resumed run, from where it started: no new plan. */
  resumeInfo(
    kid: LearningKid,
    state: Pick<RunState, 'topicId' | 'practice'>,
  ): { info: PracticeRunInfo; demo?: PublicDemo } {
    const start = state.practice?.find((s) => s.topic === state.topicId);
    const ladder =
      state.topicId === null
        ? undefined
        : this.curriculum.ladder(state.topicId, kid.language);
    if (!start || !ladder) {
      return { info: { topic: null, level: 0, maxLevel: 0 } };
    }
    const step = stepOf(start.rating, start.maxStep);
    const demoLevel = practiceDemoLevel(ladder, step);
    return {
      info: {
        topic: start.topic,
        level: step + 1,
        maxLevel: start.maxStep + 1,
      },
      ...(demoLevel ? { demo: this.demo(demoLevel, kid) } : {}),
    };
  }

  /** Creates the topic's progress row, so the demo plays by itself only once. */
  async markDemoSeen(kid: LearningKid, start: PracticeTopicStart) {
    await this.store
      .markDemoSeen(kid.id, start.topic, start.rating, start.pathStep)
      .catch((error) =>
        this.logger.warn(
          `Could not mark a practice demo as seen: ${errorMessage(error)}`,
        ),
      );
  }

  private async planTopic(
    kid: LearningKid,
    standings: ReadonlyMap<PracticeTopicId, TopicStanding>,
    topic: PracticeTopicId,
    seed: number,
    now: Date,
  ): Promise<PracticePlan> {
    const standing = standings.get(topic);
    if (!standing) {
      throw topicNotFound();
    }
    if (standing.reach.state === 'locked') {
      throw topicLocked();
    }
    const reviews = await this.reviewItems(
      kid,
      await this.store.dueReviews(
        kid.id,
        kid.language,
        now,
        [topic],
        PRACTICE_MAX_REVIEWS,
      ),
    );
    const history: GeneratedItem[] = [...reviews];
    const fresh = planSteps(
      standing.rating,
      standing.reach.maxStep,
      PRACTICE_TOPIC_ITEMS - reviews.length,
    ).map((step, index) => {
      const item = this.practiceItem(kid, standing, step, seed, index, history);
      history.push(item);
      return item;
    });
    const step = stepOf(standing.rating, standing.reach.maxStep);
    const demoLevel = practiceDemoLevel(standing.ladder, step);
    return {
      topicId: topic,
      items: this.indexed(interleave(fresh, reviews)),
      starts: [this.start(standing)],
      info: {
        topic,
        level: step + 1,
        maxLevel: standing.reach.maxStep + 1,
      },
      ...(demoLevel ? { demo: this.demo(demoLevel, kid) } : {}),
      demoSeen: standing.record?.demoSeen === true,
    };
  }

  private async planMix(
    kid: LearningKid,
    standings: ReadonlyMap<PracticeTopicId, TopicStanding>,
    seed: number,
    now: Date,
  ): Promise<PracticePlan> {
    const open = [...standings.values()].filter(
      (standing) => standing.reach.state === 'open',
    );
    if (open.length === 0) {
      throw nothingToPractice();
    }
    const counts = new Map(
      (await this.store.reviewCounts(kid.id, kid.language, now)).map(
        (count) => [count.topicId, count.due],
      ),
    );
    const rng = createRng(mixSeed(seed, 0x6d1c));
    const chosen = open
      .map((standing) => ({
        standing,
        priority: mixPriority(
          {
            dueReviews: counts.get(standing.ladder.topic) ?? 0,
            lastPracticedAt: standing.record?.lastPracticedAt ?? null,
            accuracy: standing.record?.accuracy,
          },
          now,
          rng.next(),
        ),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, PRACTICE_MIX_TOPICS)
      .map((entry) => entry.standing);
    const reviews = await this.reviewItems(
      kid,
      await this.store.dueReviews(
        kid.id,
        kid.language,
        now,
        open.map((standing) => standing.ladder.topic),
        PRACTICE_MAX_REVIEWS,
      ),
    );
    const history: GeneratedItem[] = [...reviews];
    const fresh: RunItem[] = [];
    const rounds = Math.ceil(
      (PRACTICE_MIX_TOPICS * PRACTICE_MIX_ITEMS_PER_TOPIC) / chosen.length,
    );
    for (let round = 0; round < rounds; round += 1) {
      for (const standing of chosen) {
        const step = stepOf(standing.rating, standing.reach.maxStep);
        const item = this.practiceItem(
          kid,
          standing,
          step,
          seed,
          fresh.length,
          history,
        );
        history.push(item);
        fresh.push(item);
      }
    }
    const topics = new Set([
      ...chosen.map((standing) => standing.ladder.topic),
      ...reviews.map((item) => item.topic),
    ]);
    return {
      topicId: null,
      items: this.indexed(interleave(fresh, reviews)),
      starts: open
        .filter((standing) => topics.has(standing.ladder.topic))
        .map((standing) => this.start(standing)),
      info: { topic: null, level: 0, maxLevel: 0 },
      demoSeen: true,
    };
  }

  private start(standing: TopicStanding): PracticeTopicStart {
    return {
      topic: standing.ladder.topic,
      rating: standing.rating,
      maxStep: standing.reach.maxStep,
      pathStep: standing.reach.pathStep,
      runs: standing.record?.runs ?? 0,
      ...(standing.record?.accuracy !== undefined
        ? { accuracy: standing.record.accuracy }
        : {}),
    };
  }

  private practiceItem(
    kid: LearningKid,
    standing: TopicStanding,
    step: number,
    seed: number,
    index: number,
    history: readonly GeneratedItem[],
  ): RunItem {
    const ladderStep = standing.ladder.steps[step];
    const item = generatePracticeItem(
      standing.ladder,
      ladderStep,
      seed,
      index,
      this.options(kid),
      history,
    );
    return {
      ...item,
      levelId: ladderStep.level.id,
      skillId: ladderStep.level.skill,
      topic: standing.ladder.topic,
      tier: step,
    };
  }

  /**
   * Due mistakes as run items, made again from their source. A mistake whose
   * level changed so that it no longer asks the same question is dropped.
   */
  private async reviewItems(
    kid: LearningKid,
    rows: readonly ReviewRow[],
  ): Promise<RunItem[]> {
    const items: RunItem[] = [];
    const stale: string[] = [];
    for (const row of rows) {
      const ref = this.curriculum.levelFor(row.source.levelId, kid.language);
      let exercise;
      try {
        exercise =
          ref &&
          regenerateExercise(
            this.curriculum.content.index.levels,
            row.source,
            this.options(kid),
          );
      } catch (error) {
        this.logger.error(
          `Could not make mistake ${row.id} again: ${errorMessage(error)}`,
        );
        continue;
      }
      if (!ref || !exercise || exerciseKey(exercise) !== row.itemKey) {
        stale.push(row.id);
        continue;
      }
      items.push({
        ...exercise,
        index: items.length,
        key: row.itemKey,
        source: row.source,
        levelId: ref.level.id,
        skillId: ref.level.skill,
        topic: row.topicId,
        tier:
          this.curriculum.stepIndex(row.topicId, ref.level.id, kid.language) ??
          row.tier,
        again: 'review',
      });
    }
    if (stale.length > 0) {
      await this.store
        .deleteReviews(kid.id, stale)
        .catch((error) =>
          this.logger.warn(
            `Could not drop outdated mistakes: ${errorMessage(error)}`,
          ),
        );
    }
    return items;
  }

  private indexed(items: readonly RunItem[]): RunItem[] {
    return items.map((item, index) => ({ ...item, index }));
  }

  private demo(level: Level, kid: LearningKid): PublicDemo {
    return toPublicDemo(
      generateDemo(level, kid.language, this.curriculum.content),
    );
  }

  private options(kid: LearningKid) {
    return { locale: kid.language, content: this.curriculum.content };
  }
}
