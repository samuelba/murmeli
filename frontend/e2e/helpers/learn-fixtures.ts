import {
  type AnyAnswer,
  type Content,
  type ExerciseTypeId,
  type GeneratedItem,
  type Level,
  type Locale,
  type MapResponse,
  type PracticeCatalogResponse,
  type PracticeLadder,
  type PracticeTopicId,
  type PracticeTopicView,
  type ProgressState,
  type Stars,
  type World,
  checkAnswer,
  generateDemo,
  generatePracticeItem,
  generateRun,
  gradeRank,
  isPassed,
  itemScore,
  loadContent,
  parseAnswer,
  PRACTICE_TOPIC_TITLES,
  practiceDemoLevel,
  practiceLadders,
  runScore,
  starsFor,
  toPublicDemo,
  toPublicExercise,
} from '@murmeli/content';
import { type MockBackend, apiError } from './mock-api';

let cached: Content | undefined;

/** The real curriculum, loaded once per worker. */
export function content(): Content {
  cached ??= loadContent();
  return cached;
}

export interface LearnOptions {
  locale?: Locale;
  startClass?: 'KG1' | 'KG2' | '1' | '2';
  /** Stars per level id, as if those levels were played before. */
  progress?: Record<string, Stars>;
  /** Level ids whose demo the kid has already seen. */
  demoSeen?: string[];
  /** Every run start answers 403 DAILY_LIMIT_REACHED. */
  dailyLimitReached?: boolean;
  /** Level runs use only this exercise type (and no demo). */
  exerciseType?: ExerciseTypeId;
  /** With `exerciseType`: take the generators of this level (e.g. money pay or compare). */
  exerciseLevel?: string;
  /** Badge ids the kid already holds on the server (earned on another device). */
  badges?: string[];
  /** Answer the map like a backend from before the badge list (no `badges`). */
  mapWithoutBadges?: boolean;
  /** Runs start for any level, even a locked one (to reach a demo directly). */
  unlockAll?: boolean;
  /** Items per run (default: the level's own count). */
  items?: number;
  seed?: number;
}

export interface RunPractice {
  readonly topic: PracticeTopicId;
  readonly level: number;
  readonly maxLevel: number;
}

export interface Run {
  readonly id: string;
  readonly level: Level | null;
  readonly practice?: RunPractice;
  readonly items: GeneratedItem[];
  readonly attempts: number[];
  readonly scores: number[];
}

interface LevelState {
  readonly state: ProgressState;
  readonly stars: Stars;
}

/** First level of the content whose generators include `type`, for type-focused runs. */
export function levelWithType(
  type: ExerciseTypeId,
  locale: Locale = 'de-CH',
  levelId?: string,
): Level {
  for (const track of content().tracks) {
    if (!track.locales.includes(locale)) {
      continue;
    }
    for (const world of track.worlds) {
      for (const level of world.levels) {
        if (levelId !== undefined && level.id !== levelId) {
          continue;
        }
        const generators = level.generators.filter((generator) => generator.type === type);
        if (generators.length > 0) {
          return { ...level, generators };
        }
      }
    }
  }
  throw new Error(`No ${locale} level ${levelId ?? ''} uses ${type}`);
}

/**
 * A stateful fake of the learning API (docs/internal/learning-engine.md §3) built on the real
 * content runtime: items, demos, checking, scoring and unlocking behave like the backend.
 */
export class LearnBackend {
  readonly runs = new Map<string, Run>();
  readonly progress = new Map<string, Stars>();
  readonly demoSeen = new Set<string>();
  /** Badge ids the kid holds (docs/internal/learning-engine.md §7). */
  readonly badges = new Set<string>();
  private practiced = false;
  /** Practice step per topic (1-based), as the server keeps it between runs. */
  readonly topicLevels = new Map<string, number>();
  private badgesSeeded = false;
  private nextRun = 1;
  private seed: number;

  constructor(private readonly options: LearnOptions = {}) {
    Object.entries(options.progress ?? {}).forEach(([id, stars]) => this.progress.set(id, stars));
    options.demoSeen?.forEach((id) => this.demoSeen.add(id));
    options.badges?.forEach((id) => this.badges.add(id));
    this.seed = options.seed ?? 4242;
  }

  get locale(): Locale {
    return this.options.locale ?? 'de-CH';
  }

  install(backend: MockBackend): this {
    backend.onAll({
      'GET /api/learn/map': () => ({ body: this.map() }),
      'POST /api/learn/levels/:levelId/runs': (request) =>
        this.startLevel(request.params['levelId']),
      'GET /api/learn/practice': () => ({ body: this.practiceCatalog() }),
      'POST /api/learn/practice/runs': (request) =>
        this.startPractice((request.body as { topic?: string } | null)?.topic),
      'POST /api/learn/runs/:runId/answers': (request) =>
        this.answer(request.params['runId'], request.body as { index: number; answer: unknown }),
      'POST /api/learn/runs/:runId/finish': (request) => this.finish(request.params['runId']),
    });
    return this;
  }

  /** The run that was started last. */
  get current(): Run {
    const run = [...this.runs.values()].at(-1);
    if (!run) {
      throw new Error('No run started');
    }
    return run;
  }

  solution(index: number): AnyAnswer {
    return this.current.items[index]!.solution.answer as AnyAnswer;
  }

  private tracks() {
    return content().tracks.filter((track) => track.locales.includes(this.locale));
  }

  private placed(world: World): boolean {
    return gradeRank(world.grade) < gradeRank(this.options.startClass ?? 'KG1');
  }

  private levelStates(): Map<string, LevelState> {
    const states = new Map<string, LevelState>();
    const completed = new Set<string>();
    for (const track of this.tracks()) {
      for (const world of track.worlds) {
        const placed = this.placed(world);
        const open = placed || world.requires.every((id) => completed.has(id));
        let previousPassed = open;
        let allDone = true;
        for (const level of world.levels) {
          const stars = this.progress.get(level.id) ?? 0;
          const passed = isPassed(stars);
          const state: ProgressState = passed
            ? 'passed'
            : placed
              ? 'skipped'
              : previousPassed
                ? 'unlocked'
                : 'locked';
          states.set(level.id, { state, stars });
          previousPassed = passed;
          allDone &&= passed || placed;
        }
        if (allDone) {
          completed.add(world.id);
        }
      }
    }
    return states;
  }

  map(): MapResponse {
    if (!this.badgesSeeded) {
      this.badgesSeeded = true;
      this.awardBadges();
    }
    const map = this.trail();
    return this.options.mapWithoutBadges
      ? ({ tracks: map.tracks } as MapResponse)
      : { ...map, badges: [...this.badges] };
  }

  private trail(): Omit<MapResponse, 'badges'> {
    const states = this.levelStates();
    const locale = this.locale;
    return {
      tracks: this.tracks().map((track) => ({
        id: track.id,
        title: track.title[locale] ?? track.id,
        icon: track.icon,
        worlds: track.worlds.map((world) => {
          const levels = world.levels.map((level) => ({
            id: level.id,
            title: level.title[locale] ?? level.id,
            ...states.get(level.id)!,
          }));
          const all = (state: ProgressState) => levels.every((level) => level.state === state);
          const done = levels.every(
            (level) => level.state === 'passed' || level.state === 'skipped',
          );
          const state: ProgressState = all('locked')
            ? 'locked'
            : all('passed')
              ? 'passed'
              : done
                ? 'skipped'
                : 'unlocked';
          return {
            id: world.id,
            title: world.title[locale] ?? world.id,
            scene: world.scene,
            grade: world.grade,
            state,
            stars: levels.reduce((sum, level) => sum + level.stars, 0),
            maxStars: levels.length * 3,
            levels,
          };
        }),
      })),
    };
  }

  private findLevel(id: string): Level | null {
    return content().index.levels[id]?.level ?? null;
  }

  private createRun(level: Level | null, items: GeneratedItem[], practice?: RunPractice): Run {
    const run: Run = {
      id: `run-${this.nextRun++}`,
      level,
      ...(practice ? { practice } : {}),
      items,
      attempts: items.map(() => 0),
      scores: items.map(() => 0),
    };
    this.runs.set(run.id, run);
    return run;
  }

  private generate(level: Level, count?: number): GeneratedItem[] {
    this.seed += 1;
    return generateRun(level, this.seed, { locale: this.locale, content: content() }, count);
  }

  private startLevel(levelId: string | undefined) {
    if (this.options.dailyLimitReached) {
      return apiError(403, 'DAILY_LIMIT_REACHED');
    }
    const level = levelId ? this.findLevel(levelId) : null;
    const locked = this.levelStates().get(level?.id ?? '')?.state === 'locked';
    if (!level || (locked && !this.options.unlockAll)) {
      return apiError(404, 'LEVEL_NOT_FOUND');
    }
    const type = this.options.exerciseType;
    const source = type ? levelWithType(type, this.locale, this.options.exerciseLevel) : level;
    const run = this.createRun(level, this.generate(source, this.options.items ?? source.items));
    const demoSeen = this.demoSeen.has(level.id);
    this.demoSeen.add(level.id);
    const demo = type ? undefined : toPublicDemo(generateDemo(level, this.locale, content()));
    return {
      status: 201,
      body: {
        runId: run.id,
        items: run.items.map(toPublicExercise),
        demoSeen,
        ...(demo ? { demo } : {}),
      },
    };
  }

  /** A small version of the server's practice reach: open with the trail, plus a peek ahead. */
  private topicView(ladder: PracticeLadder): PracticeTopicView {
    const states = this.levelStates();
    const open = ladder.steps.filter((step) => states.get(step.level.id)?.state !== 'locked');
    const worlds = new Map(this.tracks().flatMap((t) => t.worlds.map((w) => [w.id, w])));
    const worldOpen = (id: string) =>
      worlds.get(id)?.levels.some((level) => states.get(level.id)?.state !== 'locked') ?? false;
    const first = worlds.get(ladder.steps[0]!.worldId)!;
    const ahead = open.length === 0 && first.requires.every(worldOpen);
    const reach = open.length > 0 ? open.at(-1)!.index + 1 : ahead ? 0 : -1;
    const maxLevel = reach < 0 ? 0 : Math.min(ladder.steps.length, reach + 2);
    const level =
      reach < 0 ? 0 : Math.min(maxLevel, this.topicLevels.get(ladder.topic) ?? Math.max(1, reach));
    return {
      id: ladder.topic,
      title: PRACTICE_TOPIC_TITLES[ladder.topic][this.locale] ?? ladder.topic,
      state: open.length > 0 ? 'open' : ahead ? 'ahead' : 'locked',
      level,
      maxLevel,
      levels: ladder.steps.length,
      dueReviews: 0,
      practiced: this.topicLevels.has(ladder.topic),
    };
  }

  practiceCatalog(): PracticeCatalogResponse {
    const ladders = practiceLadders(this.tracks());
    const tracks = this.tracks()
      .map((track) => ({
        id: track.id,
        title: track.title[this.locale] ?? track.id,
        icon: track.icon,
        topics: ladders
          .filter((ladder) => ladder.trackId === track.id)
          .map((ladder) => this.topicView(ladder)),
      }))
      .filter((track) => track.topics.length > 0);
    const available = tracks.some((track) => track.topics.some((t) => t.state === 'open'));
    return { tracks, mix: { available, dueReviews: 0 } };
  }

  private startTopic(topic: string) {
    const ladder = practiceLadders(this.tracks()).find((l) => l.topic === topic);
    if (!ladder) {
      return apiError(404, 'TOPIC_NOT_FOUND');
    }
    const view = this.topicView(ladder);
    if (view.state === 'locked') {
      return apiError(403, 'TOPIC_LOCKED');
    }
    const step = ladder.steps[view.level - 1]!;
    const options = { locale: this.locale, content: content() };
    this.seed += 1;
    const items: GeneratedItem[] = [];
    for (let index = 0; index < (this.options.items ?? 8); index += 1) {
      items.push(generatePracticeItem(ladder, step, this.seed, index, options, items));
    }
    const run = this.createRun(null, items, {
      topic: ladder.topic,
      level: view.level,
      maxLevel: view.maxLevel,
    });
    const demoLevel = practiceDemoLevel(ladder, step.index);
    const key = `topic:${topic}`;
    const demoSeen = this.demoSeen.has(key);
    this.demoSeen.add(key);
    return {
      status: 201,
      body: {
        runId: run.id,
        items: run.items.map(toPublicExercise),
        demoSeen,
        ...(demoLevel
          ? { demo: toPublicDemo(generateDemo(demoLevel, this.locale, content())) }
          : {}),
        practice: run.practice,
      },
    };
  }

  private startPractice(topic?: string) {
    if (this.options.dailyLimitReached) {
      return apiError(403, 'DAILY_LIMIT_REACHED');
    }
    if (topic !== undefined) {
      return this.startTopic(topic);
    }
    const states = this.levelStates();
    const levels = this.tracks()
      .flatMap((track) => track.worlds.flatMap((world) => world.levels))
      .filter((level) => states.get(level.id)?.state !== 'locked')
      .slice(0, 3);
    const mixed: Level = { ...levels[0]!, generators: levels.flatMap((l) => l.generators) };
    const run = this.createRun(null, this.generate(mixed, this.options.items ?? 8));
    return {
      status: 201,
      body: {
        runId: run.id,
        items: run.items.map(toPublicExercise),
        demoSeen: true,
        practice: { topic: null, level: 0, maxLevel: 0 },
      },
    };
  }

  private answer(runId: string | undefined, body: { index: number; answer: unknown }) {
    const run = runId ? this.runs.get(runId) : undefined;
    const item = run?.items[body.index];
    if (!run || !item) {
      return apiError(404, 'RUN_NOT_FOUND');
    }
    if (run.attempts[body.index]! >= 2) {
      return apiError(409, 'ITEM_DONE');
    }
    const attempt = ++run.attempts[body.index]!;
    const parsed = parseAnswer(item.type, body.answer);
    const result = parsed.success ? checkAnswer(item.solution, parsed.answer) : { correct: false };
    run.scores[body.index] = itemScore(result.correct, attempt);
    if (result.correct) {
      run.attempts[body.index] = 2;
      return { status: 201, body: { correct: true, attempt } };
    }
    return {
      status: 201,
      body:
        attempt >= 2
          ? { correct: false, attempt, solution: item.solution.answer }
          : { correct: false, attempt, hint: item.solution.hint },
    };
  }

  private finish(runId: string | undefined) {
    const run = runId ? this.runs.get(runId) : undefined;
    if (!run) {
      return apiError(404, 'RUN_NOT_FOUND');
    }
    const score = runScore(run.scores);
    const stars = starsFor(score, run.level?.passRatio ?? 0.8);
    if (!this.badgesSeeded) {
      this.badgesSeeded = true;
      this.awardBadges();
    }
    const before = this.levelStates();
    const worldsBefore = this.trail();
    if (!run.level) {
      this.practiced = true;
    }
    if (run.level && stars > (this.progress.get(run.level.id) ?? 0)) {
      this.progress.set(run.level.id, stars);
    }
    const after = this.levelStates();
    const levels = [...after]
      .filter(([id, state]) => state.state === 'unlocked' && before.get(id)?.state === 'locked')
      .map(([id]) => id);
    const lockedBefore = new Set(
      worldsBefore.tracks
        .flatMap((track) => track.worlds)
        .filter((world) => world.state === 'locked')
        .map((world) => world.id),
    );
    const worlds = this.trail()
      .tracks.flatMap((track) => track.worlds)
      .filter((world) => world.state !== 'locked' && lockedBefore.has(world.id))
      .map((world) => world.id);
    return {
      status: 201,
      body: {
        score,
        stars,
        passed: run.level !== null && isPassed(stars),
        unlocked: { levels, worlds },
        newBadges: this.awardBadges(),
        ...(run.level ? {} : { practice: this.practiceResult(run, score) }),
      },
    };
  }

  /** All right on the first try: one step up, like the server's rating. */
  private practiceResult(run: Run, score: number) {
    const missed = run.scores.filter((value) => value < 1).length;
    const practice = run.practice;
    if (!practice) {
      return { topics: [], reviewsSolved: 0, reviewsSaved: missed };
    }
    const level = score >= 1 ? Math.min(practice.maxLevel, practice.level + 1) : practice.level;
    this.topicLevels.set(practice.topic, level);
    return {
      topics: [
        {
          id: practice.topic,
          title: PRACTICE_TOPIC_TITLES[practice.topic][this.locale] ?? practice.topic,
          levelBefore: practice.level,
          level,
          maxLevel: practice.maxLevel,
        },
      ],
      reviewsSolved: 0,
      reviewsSaved: missed,
    };
  }

  private awardBadges(): string[] {
    const worlds = this.trail().tracks.flatMap((track) => track.worlds);
    const levels = worlds.flatMap((world) => world.levels);
    const earned = {
      'first-level': levels.some((level) => level.state === 'passed'),
      'first-world': worlds.some((world) => world.state === 'passed'),
      'star-collector': levels.filter((level) => level.stars === 3).length >= 5,
      'first-practice': this.practiced,
    };
    const fresh = Object.entries(earned)
      .filter(([id, done]) => done && !this.badges.has(id))
      .map(([id]) => id);
    fresh.forEach((id) => this.badges.add(id));
    return fresh;
  }
}
