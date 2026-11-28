import type { Level, Track } from '../world.ts';
import {
  type GenerateOptions,
  type GeneratedItem,
  type ItemHistory,
  type SourceSpec,
  generateVaried,
} from '../runtime/exercise.ts';
import { itemSeed } from '../runtime/rng.ts';
import { PRACTICE_TOPIC_IDS, narrowSpec } from './topics.ts';
import type { PracticeTopicId } from './topics.ts';

/** One rung of a topic's difficulty ladder: the topic's part of one level. */
export interface PracticeStep {
  /** 0-based difficulty within the topic */
  readonly index: number;
  readonly trackId: string;
  readonly worldId: string;
  readonly level: Level;
  readonly specs: readonly SourceSpec[];
}

export interface PracticeLadder {
  readonly topic: PracticeTopicId;
  readonly trackId: string;
  readonly steps: readonly PracticeStep[];
}

function stepSpecs(level: Level, topic: PracticeTopicId): SourceSpec[] {
  return level.generators.flatMap((generator, index) => {
    const spec = narrowSpec(generator, topic);
    return spec === null
      ? []
      : [{ spec, weight: generator.weight, generator: index }];
  });
}

/**
 * Every topic that the given tracks train, with its steps in curriculum
 * order (track, world, level): the further along the trail, the harder.
 */
export function practiceLadders(tracks: readonly Track[]): PracticeLadder[] {
  const levels = tracks.flatMap((track) =>
    track.worlds.flatMap((world) =>
      world.levels.map((level) => ({
        trackId: track.id,
        worldId: world.id,
        level,
      })),
    ),
  );
  return PRACTICE_TOPIC_IDS.flatMap((topic) => {
    const steps = levels.flatMap((entry) => {
      const specs = stepSpecs(entry.level, topic);
      return specs.length > 0 ? [{ ...entry, specs }] : [];
    });
    if (steps.length === 0) {
      return [];
    }
    return [
      {
        topic,
        trackId: steps[0]!.trackId,
        steps: steps.map((step, index) => ({ index, ...step })),
      },
    ];
  });
}

/** A level demo shows the topic only if its exercise needs no narrowing. */
export function demoFits(level: Level, topic: PracticeTopicId): boolean {
  return narrowSpec(level.demo.exercise, topic) === level.demo.exercise;
}

/**
 * The "Zeig mir" level for a topic at a step: the nearest fitting demo at or
 * below the step, else the first fitting one above it.
 */
export function practiceDemoLevel(
  ladder: PracticeLadder,
  step: number,
): Level | undefined {
  const fitting = ladder.steps.filter((s) => demoFits(s.level, ladder.topic));
  return (fitting.filter((s) => s.index <= step).at(-1) ?? fitting[0])?.level;
}

/** A practice item at one step, varied against the run so far. */
export function generatePracticeItem(
  ladder: PracticeLadder,
  step: PracticeStep,
  runSeed: number,
  index: number,
  options: GenerateOptions,
  history: ItemHistory = [],
): GeneratedItem {
  return generateVaried(
    step.level.id,
    step.specs,
    itemSeed(runSeed, `${ladder.topic}:${step.level.id}`, index),
    index,
    options,
    history,
    ladder.topic,
  );
}
