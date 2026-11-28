import { Injectable } from '@nestjs/common';
import {
  type PracticeResult,
  type PracticeTopicResult,
  PRACTICE_TOPIC_TITLES,
} from '@murmeli/content';
import type { EntityManager } from 'typeorm';
import { localize } from '../content/curriculum';
import type { LearningKid } from '../progress/progress.service';
import {
  type RunItemState,
  type RunState,
  scoredItems,
} from '../runs/run-state';
import { nextAccuracy, nextRating, stepOf } from './adaptive';
import { PracticeStore } from './practice.store';

const firstTry = (item: RunItemState) => item.correctAt === 1;

/**
 * What a finished run changes on the practice ground: every run feeds the
 * mistakes asked again later; a practice run also counts the practice of the
 * day and moves the rating of every topic it practiced with new items (a
 * topic that only had a due mistake in a mix keeps its rating).
 */
@Injectable()
export class PracticeRecorder {
  constructor(private readonly store: PracticeStore) {}

  async record(
    kid: LearningKid,
    state: RunState,
    day: string,
    now: Date,
    db: EntityManager,
  ): Promise<PracticeResult | undefined> {
    const answered = scoredItems(state).filter((item) => item.attempts > 0);
    const reviewsSolved = await this.store.recordSolved(
      kid.id,
      answered.filter(firstTry).map((item) => item.key),
      now,
      db,
    );
    const reviewsSaved = await this.store.recordMisses(
      kid.id,
      state.locale,
      answered
        .filter((item) => !firstTry(item))
        .map((item) => ({
          topicId: item.topic,
          itemKey: item.key,
          source: item.source,
          tier: item.tier,
        })),
      now,
      db,
    );
    if (state.mode !== 'practice') {
      return undefined;
    }
    const topics: PracticeTopicResult[] = [];
    for (const start of state.practice ?? []) {
      const items = answered.filter((item) => item.topic === start.topic);
      if (items.length === 0) {
        continue;
      }
      const right = items.filter(firstTry).length;
      await this.store.addDaily(
        kid.id,
        start.topic,
        day,
        items.length,
        right,
        db,
      );
      if (items.every((item) => item.again === 'review')) {
        continue;
      }
      const rating = nextRating(
        start.rating,
        items.map((item) => ({
          tier: item.tier,
          score: firstTry(item) ? 1 : 0,
        })),
        start.runs,
        start.maxStep,
      );
      await this.store.saveTopic(
        kid.id,
        {
          topicId: start.topic,
          rating,
          pathStep: start.pathStep,
          items: items.length,
          firstTry: right,
          accuracy: nextAccuracy(start.accuracy, right, items.length),
        },
        now,
        db,
      );
      topics.push({
        id: start.topic,
        title: localize(PRACTICE_TOPIC_TITLES[start.topic], state.locale),
        levelBefore: stepOf(start.rating, start.maxStep) + 1,
        level: stepOf(rating, start.maxStep) + 1,
        maxLevel: start.maxStep + 1,
      });
    }
    return { topics, reviewsSolved, reviewsSaved };
  }
}
