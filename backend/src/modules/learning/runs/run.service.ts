import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  type AnswerResponse,
  type FinishRunResponse,
  type GeneratedItem,
  type Level,
  type PracticeTopicId,
  type StartRunResponse,
  generateDemo,
  generateRun,
  isExerciseTypeId,
  randomSeed,
  toPublicDemo,
  topicOfExercise,
} from '@murmeli/content';
import { RetryAfterException } from '../../../common/errors/api-exception';
import { errorMessage } from '../../../common/errors/error-message';
import { AttemptLimiter } from '../../auth/limits/attempt-limiter.service';
import type { LimitPolicy } from '../../auth/limits/attempt-limiter.service';
import { Curriculum } from '../content/curriculum';
import {
  invalidField,
  itemDone,
  runBusy,
  runNotFound,
} from '../learning.errors';
import { LearningSettings } from '../learning.settings';
import { PracticeService } from '../practice/practice.service';
import { type AttemptInsert, ProgressStore } from '../progress/progress.store';
import {
  type LearningKid,
  ProgressService,
} from '../progress/progress.service';
import {
  type NewRun,
  type RunItem,
  type RunState,
  applyAnswer,
  createRunState,
  publicItem,
  runProgress,
  summarizeRun,
} from './run-state';
import { RunStore, type StoredRun } from './run-store';

export const LEARN_RATE_LIMITED = 'LEARN_RATE_LIMITED';
const UPDATE_RETRIES = 3;

/**
 * Level and practice runs: generation, answers and finishing (contract §3).
 * Solutions stay in Redis; the client only ever sees prompts and payloads,
 * and a solution only after the last attempt.
 */
@Injectable()
export class RunService {
  private readonly logger = new Logger(RunService.name);

  constructor(
    private readonly curriculum: Curriculum,
    private readonly progress: ProgressService,
    private readonly store: ProgressStore,
    private readonly runs: RunStore,
    private readonly limiter: AttemptLimiter,
    private readonly settings: LearningSettings,
    private readonly practice: PracticeService,
  ) {}

  async startLevel(
    kid: LearningKid,
    levelId: string,
    now = new Date(),
  ): Promise<StartRunResponse> {
    await this.limit(this.settings.runs, kid.id);
    const access = await this.progress.levelAccess(kid, levelId);
    const level = access.ref.level;
    const demo = toPublicDemo(
      generateDemo(level, kid.language, this.curriculum.content),
    );
    await this.progress.assertWithinDailyLimit(kid, now);
    const unfinished = await this.unfinished(kid, 'level', level.id, null);
    if (unfinished) {
      return { ...this.resumed(unfinished), demo };
    }
    const seed = randomSeed();
    const items = generateRun(level, seed, this.options(kid)).map((item) =>
      this.runItem(item, level, kid),
    );
    const runId = await this.begin(
      kid,
      { mode: 'level', levelId: level.id, seed, items },
      now,
    );
    if (!access.demoSeen) {
      await this.progress
        .markDemoSeen(kid, level.id)
        .catch((error) =>
          this.logger.warn(
            `Could not mark a demo as seen: ${errorMessage(error)}`,
          ),
        );
    }
    return {
      runId,
      items: items.map(publicItem),
      demoSeen: access.demoSeen,
      demo,
    };
  }

  /** A run on one practice topic, or "Murmeli wählt" when `topic` is null. */
  async startPractice(
    kid: LearningKid,
    topic: PracticeTopicId | null,
    now = new Date(),
  ): Promise<StartRunResponse> {
    await this.limit(this.settings.runs, kid.id);
    await this.progress.assertWithinDailyLimit(kid, now);
    const unfinished = await this.unfinished(kid, 'practice', null, topic);
    if (unfinished) {
      const { info, demo } = this.practice.resumeInfo(kid, unfinished);
      return {
        ...this.resumed(unfinished),
        ...(demo ? { demo } : {}),
        practice: info,
      };
    }
    const seed = randomSeed();
    const plan = await this.practice.plan(kid, topic, seed, now);
    const runId = await this.begin(
      kid,
      {
        mode: 'practice',
        levelId: null,
        topicId: topic,
        practice: plan.starts,
        seed,
        items: plan.items,
      },
      now,
    );
    if (!plan.demoSeen && plan.starts[0]) {
      await this.practice.markDemoSeen(kid, plan.starts[0]);
    }
    return {
      runId,
      items: plan.items.map(publicItem),
      demoSeen: plan.demoSeen,
      ...(plan.demo ? { demo: plan.demo } : {}),
      practice: plan.info,
    };
  }

  async answer(
    kid: LearningKid,
    runId: string,
    index: number,
    answer: unknown,
    now: () => number = Date.now,
  ): Promise<AnswerResponse> {
    await this.limit(this.settings.answers, kid.id);
    let seenAttempts: number | undefined;
    for (let retry = 0; retry < UPDATE_RETRIES; retry += 1) {
      const current = await this.ownedRun(kid, runId);
      const attempts = current.state.items[index]?.attempts;
      if (seenAttempts !== undefined && attempts !== seenAttempts) {
        throw runBusy();
      }
      seenAttempts = attempts;
      const outcome = applyAnswer(current.state, index, answer, now());
      if (!outcome.ok) {
        throw this.answerError(outcome.error);
      }
      if (await this.runs.update(current, outcome.state)) {
        await this.recordAttempt({
          ...outcome.record,
          kidId: kid.id,
          runId,
          mode: current.state.mode,
        });
        return outcome.response;
      }
    }
    throw runBusy();
  }

  async finish(
    kid: LearningKid,
    runId: string,
    now = new Date(),
  ): Promise<FinishRunResponse> {
    for (let retry = 0; retry < UPDATE_RETRIES; retry += 1) {
      const current = await this.ownedRun(kid, runId);
      if (await this.runs.take(current)) {
        const summary = summarizeRun(current.state, now.getTime());
        try {
          return await this.progress.finish(kid, current.state, summary, now);
        } catch (error) {
          await this.runs.restore(current).catch(() => false);
          throw error;
        }
      }
    }
    throw runBusy();
  }

  private options(kid: LearningKid) {
    return { locale: kid.language, content: this.curriculum.content };
  }

  private runItem(
    item: GeneratedItem,
    level: Level,
    kid: LearningKid,
  ): RunItem {
    const topic = topicOfExercise(item);
    return {
      ...item,
      levelId: level.id,
      skillId: level.skill,
      topic,
      tier: this.curriculum.stepIndex(topic, level.id, kid.language) ?? 0,
    };
  }

  /**
   * The kid's active run of this level (or practice topic) in the kid's
   * language, so a reload continues it instead of starting over. A run with
   * an exercise type this version no longer knows is started over.
   */
  private async unfinished(
    kid: LearningKid,
    mode: RunState['mode'],
    levelId: string | null,
    topicId: PracticeTopicId | null,
  ): Promise<RunState | null> {
    const state = (await this.runs.activeOf(kid.id))?.state;
    const matches =
      state?.kidId === kid.id &&
      state.mode === mode &&
      state.levelId === levelId &&
      state.topicId === topicId &&
      state.locale === kid.language &&
      state.items.every((item) => isExerciseTypeId(item.exercise.type));
    return matches ? state : null;
  }

  private resumed(state: RunState): StartRunResponse {
    return {
      runId: state.runId,
      items: state.items.map((item) => item.exercise),
      demoSeen: true,
      progress: runProgress(state),
    };
  }

  private async begin(
    kid: LearningKid,
    run: Pick<
      NewRun,
      'mode' | 'levelId' | 'topicId' | 'practice' | 'seed' | 'items'
    >,
    now: Date,
  ): Promise<string> {
    const runId = randomUUID();
    const previous = await this.runs.start(
      createRunState({
        ...run,
        runId,
        kidId: kid.id,
        locale: kid.language,
        now: now.getTime(),
      }),
    );
    if (previous) {
      await this.progress
        .recordAbandoned(previous, now)
        .catch((error) =>
          this.logger.warn(
            `Could not record an abandoned run: ${errorMessage(error)}`,
          ),
        );
    }
    return runId;
  }

  /** The attempt log is analytics; the answer itself is already stored. */
  private async recordAttempt(attempt: AttemptInsert): Promise<void> {
    await this.store
      .insertAttempt(attempt)
      .catch((error) =>
        this.logger.error(`Could not store an attempt: ${errorMessage(error)}`),
      );
  }

  private async ownedRun(kid: LearningKid, runId: string): Promise<StoredRun> {
    const current = await this.runs.get(runId);
    if (!current || current.state.kidId !== kid.id) {
      throw runNotFound();
    }
    return current;
  }

  private answerError(
    error: 'ITEM_NOT_FOUND' | 'ITEM_DONE' | 'ANSWER_INVALID',
  ) {
    switch (error) {
      case 'ITEM_DONE':
        return itemDone();
      case 'ITEM_NOT_FOUND':
        return invalidField('index', 'index is not an item of this run');
      default:
        return invalidField('answer', 'answer does not fit the exercise');
    }
  }

  private async limit(policy: LimitPolicy, kidId: string): Promise<void> {
    const attempt = await this.limiter.attempt(policy, kidId);
    if (!attempt.allowed) {
      throw new RetryAfterException(
        attempt.retryAfterSeconds,
        LEARN_RATE_LIMITED,
        'Slow down a little',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
