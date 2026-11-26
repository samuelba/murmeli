import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { AudioService } from '../../core/audio/audio.service';
import { SoundEffects } from '../../core/audio/sound-effects';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { errorCodeOf } from '../../core/http/api-error';
import { KidBadges } from '../badges/kid-badges.service';
import { LearnContent } from '../content/learn-content';
import { LearnApi } from '../learn-api.service';
import { BreakTimer } from './break-timer';
import { cueDuration } from './demo-timing';
import {
  AnyAnswer,
  DAILY_LIMIT_REACHED,
  DemoAction,
  FinishRunResponse,
  HintKey,
  MapResponse,
  RunMode,
  StartRunResponse,
  isExerciseType,
} from '../learn.models';

export type Phase =
  | 'loading'
  | 'demo'
  | 'playing'
  | 'checking'
  | 'feedback'
  | 'finishing'
  | 'results'
  | 'resting'
  | 'break'
  | 'error';

/** first try, second try, or shown after two tries. */
export type Outcome = 'first' | 'second' | 'missed';

export interface Feedback {
  readonly kind: 'correct' | 'solution';
  readonly phrase: string;
  readonly solution: AnyAnswer | null;
}

export interface Unlocked {
  readonly nextLevelId: string | null;
  readonly newLevels: number;
  readonly newWorlds: readonly string[];
}

export const MAX_ATTEMPTS = 2;
const DEMO_MIN_STEP_MS = 1800;
const DEMO_MS_PER_CHAR = 55;
const REVEALING: readonly (keyof DemoAction)[] = [
  'tapAnswer',
  'fillBlank',
  'placeTiles',
  'hop',
  'clap',
  'trace',
  'placeCoins',
];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The next playable level in the same world; after a finished world, the next one on the trail. */
export function nextPlayable(map: MapResponse, levelId: string | null): string | null {
  for (const track of map.tracks) {
    const worldIndex = track.worlds.findIndex((world) =>
      world.levels.some((level) => level.id === levelId),
    );
    if (worldIndex < 0) {
      continue;
    }
    const world = track.worlds[worldIndex]!;
    const index = world.levels.findIndex((level) => level.id === levelId);
    const inWorld = world.levels.slice(index + 1).find((level) => level.state !== 'locked');
    if (inWorld) {
      return inWorld.id;
    }
    const done = world.levels.every(
      (level) => level.state === 'passed' || level.state === 'skipped',
    );
    const later = track.worlds.slice(worldIndex + 1).flatMap((next) => next.levels);
    return done ? (later.find((level) => level.state === 'unlocked')?.id ?? null) : null;
  }
  return null;
}

/**
 * The player's state machine: loading → (demo) → playing ⇄ checking → feedback → … →
 * finishing → results. A wrong first answer goes back to playing with a hint; the second
 * wrong answer shows the solution. `403 DAILY_LIMIT_REACHED` ends in `resting`.
 */
@Injectable()
export class PlayerStore {
  private readonly api = inject(LearnApi);
  private readonly audio = inject(AudioService);
  private readonly effects = inject(SoundEffects);
  private readonly content = inject(LearnContent);
  private readonly badges = inject(KidBadges);
  private readonly breakTimer = inject(BreakTimer);
  private readonly activeKid = inject(AuthService).activeKid;

  private demoGeneration = 0;
  private runGeneration = 0;
  private retryAction: (() => Promise<void>) | null = null;

  readonly mode = signal<RunMode>('level');
  readonly levelId = signal<string | null>(null);
  readonly run = signal<StartRunResponse | null>(null);
  readonly phase = signal<Phase>('loading');
  readonly index = signal(0);
  readonly attempt = signal(1);
  readonly hint = signal<HintKey | null>(null);
  readonly hintPhrase = signal('');
  readonly feedback = signal<Feedback | null>(null);
  readonly outcomes = signal<readonly (Outcome | null)[]>([]);
  readonly results = signal<FinishRunResponse | null>(null);
  readonly unlocked = signal<Unlocked | null>(null);
  readonly error = signal<ErrorMessage | null>(null);
  readonly demoStep = signal(-1);
  readonly demoDone = signal(false);
  /** The first demo bubble is read through focus; later ones and replays through a live region. */
  readonly demoReplayed = signal(false);

  readonly total = computed(() => this.run()?.items.length ?? 0);
  readonly item = computed(() => this.run()?.items[this.index()] ?? null);
  readonly demo = computed(() => this.run()?.demo ?? null);
  /** Changes for every new item and every retry, so the exercise starts fresh. */
  readonly itemKey = computed(() => `${this.index()}:${this.attempt()}`);
  readonly hintText = computed(() => this.content.hint(this.hint()));
  readonly demoCue = computed<DemoAction | null>(() => {
    const steps = this.demo()?.steps ?? [];
    return steps[this.demoStep()]?.action ?? null;
  });
  readonly demoSay = computed(() => this.demo()?.steps[this.demoStep()]?.say ?? '');
  readonly demoAnnouncement = computed(() =>
    this.demoStep() > 0 || this.demoReplayed() ? this.demoSay() : '',
  );
  readonly demoReveal = computed<AnyAnswer | null>(() => {
    const demo = this.demo();
    const shown = demo?.steps
      .slice(0, this.demoStep() + 1)
      .some((step) => REVEALING.some((key) => step.action[key] !== undefined));
    return demo && (shown || this.demoDone()) ? demo.answer : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.demoGeneration += 1;
      this.audio.stop();
    });
  }

  async start(mode: RunMode, levelId: string | null = null): Promise<void> {
    this.reset();
    const generation = this.runGeneration;
    this.mode.set(mode);
    this.levelId.set(levelId);
    this.phase.set('loading');
    await this.attempt$(generation, async () => {
      const started =
        mode === 'practice' || levelId === null
          ? await this.api.startPractice()
          : await this.api.startLevel(levelId);
      if (generation !== this.runGeneration) {
        return;
      }
      const run = { ...started, items: started.items.filter((item) => isExerciseType(item.type)) };
      this.run.set(run);
      this.outcomes.set(run.items.map(() => null));
      this.prefetchAudio(run);
      if (run.demo && !run.demoSeen) {
        this.openDemo();
      } else {
        this.enterItem();
      }
    });
  }

  openDemo(): void {
    if (!this.demo()) {
      return;
    }
    this.audio.stop();
    this.demoReplayed.set(false);
    this.phase.set('demo');
    void this.playDemo();
  }

  replayDemo(): void {
    this.demoReplayed.set(true);
    void this.playDemo();
  }

  closeDemo(): void {
    if (this.phase() !== 'demo') {
      return;
    }
    this.demoGeneration += 1;
    this.audio.stop();
    this.enterItem();
  }

  async submit(answer: AnyAnswer): Promise<void> {
    const run = this.run();
    const item = this.item();
    if (this.phase() !== 'playing' || !run || !item) {
      return;
    }
    this.phase.set('checking');
    this.audio.stop();
    const generation = this.runGeneration;
    await this.attempt$(
      generation,
      async () => {
        const response = await this.api.answer(run.runId, item.index, answer);
        if (generation !== this.runGeneration) {
          return;
        }
        if (response.correct) {
          this.settleItem(this.attempt() === 1 ? 'first' : 'second');
          this.showFeedback('correct', null);
          this.effects.play('correct');
        } else if (response.solution !== undefined || response.attempt >= MAX_ATTEMPTS) {
          this.settleItem('missed');
          this.showFeedback('solution', response.solution ?? null);
          this.effects.play('wrong');
        } else {
          this.effects.play('wrong');
          this.hint.set(response.hint ?? null);
          this.hintPhrase.set(this.content.phrase('try_again'));
          this.attempt.set(Math.max(this.attempt(), response.attempt) + 1);
          this.phase.set('playing');
          void this.audio.narrate([this.hintPhrase(), this.hintText() ?? ''].filter(Boolean));
        }
      },
      'playing',
    );
  }

  next(): void {
    if (this.phase() !== 'feedback') {
      return;
    }
    if (this.index() + 1 < this.total()) {
      this.index.update((index) => index + 1);
      this.attempt.set(1);
      if (this.breakTimer.due()) {
        this.breakTimer.reminded();
        this.audio.stop();
        this.phase.set('break');
      } else {
        this.enterItem();
      }
    } else {
      void this.finish();
    }
  }

  /** "Weiter spielen" after the break reminder. */
  resumeAfterBreak(): void {
    if (this.phase() === 'break') {
      this.enterItem();
    }
  }

  async finish(): Promise<void> {
    const run = this.run();
    if (!run || this.phase() === 'finishing' || this.phase() === 'results') {
      return;
    }
    this.audio.stop();
    this.phase.set('finishing');
    const generation = this.runGeneration;
    await this.attempt$(generation, async () => {
      const results = await this.api.finish(run.runId);
      const unlocked = await this.unlockedAfter(results);
      if (generation !== this.runGeneration) {
        return;
      }
      const kid = this.activeKid();
      if (kid) {
        this.badges.remember(kid.id, results.newBadges);
      }
      this.unlocked.set(unlocked);
      this.results.set(results);
      this.phase.set('results');
      this.effects.play('complete');
    });
  }

  retry(): Promise<void> {
    const action = this.retryAction;
    if (!action) {
      return Promise.resolve();
    }
    this.error.set(null);
    this.phase.set('loading');
    return this.attempt$(this.runGeneration, action);
  }

  speakPrompt(): void {
    const item = this.item();
    if (item) {
      this.audio.speak(item.prompt.speak);
    }
  }

  private reset(): void {
    this.runGeneration += 1;
    this.demoGeneration += 1;
    this.run.set(null);
    this.index.set(0);
    this.attempt.set(1);
    this.hint.set(null);
    this.feedback.set(null);
    this.outcomes.set([]);
    this.results.set(null);
    this.unlocked.set(null);
    this.error.set(null);
    this.demoStep.set(-1);
    this.demoDone.set(false);
    this.demoReplayed.set(false);
  }

  /** Warms the cache (service worker or HTTP) with this run's narration, for flaky Wi-Fi. */
  private prefetchAudio(run: StartRunResponse): void {
    const texts = [
      ...run.items.flatMap((item) => item.prompt.speak),
      ...(run.demo?.steps.map((step) => step.say) ?? []),
      ...this.content.phrases(),
    ];
    void this.audio.prefetch(texts);
  }

  private enterItem(): void {
    this.hint.set(null);
    this.feedback.set(null);
    this.phase.set('playing');
    const item = this.item();
    if (item) {
      void this.audio.narrate(item.prompt.speak);
    }
  }

  private settleItem(outcome: Outcome): void {
    const index = this.index();
    this.outcomes.update((outcomes) => outcomes.map((value, i) => (i === index ? outcome : value)));
  }

  private showFeedback(kind: Feedback['kind'], solution: AnyAnswer | null): void {
    const phrase = this.content.phrase(kind === 'correct' ? 'correct' : 'solution');
    this.hint.set(null);
    this.feedback.set({ kind, phrase, solution });
    this.phase.set('feedback');
    void this.audio.narrate(phrase);
  }

  private async playDemo(): Promise<void> {
    const demo = this.demo();
    if (!demo) {
      return;
    }
    const generation = ++this.demoGeneration;
    this.demoDone.set(false);
    for (const [index, step] of demo.steps.entries()) {
      this.demoStep.set(index);
      const minimum =
        Math.max(DEMO_MIN_STEP_MS, step.say.length * DEMO_MS_PER_CHAR) +
        cueDuration(demo.type, step.action, demo.payload, demo.answer);
      await Promise.all([this.audio.narrate(step.say), wait(minimum)]);
      if (generation !== this.demoGeneration) {
        return;
      }
    }
    this.demoDone.set(true);
  }

  private async unlockedAfter(results: FinishRunResponse): Promise<Unlocked> {
    const levelId = this.levelId();
    let nextLevelId: string | null = results.unlocked.levels[0] ?? null;
    let worldTitles: string[] = [...results.unlocked.worlds];
    try {
      const map = await this.api.map();
      const worlds = new Map(
        map.tracks.flatMap((track) => track.worlds).map((world) => [world.id, world.title]),
      );
      worldTitles = results.unlocked.worlds.map((id) => worlds.get(id) ?? id);
      nextLevelId = this.mode() === 'level' ? nextPlayable(map, levelId) : null;
    } catch {
      // Without the map the unlocked ids are still enough to continue.
    }
    return {
      nextLevelId,
      newLevels: results.unlocked.levels.length,
      newWorlds: worldTitles,
    };
  }

  /** Runs a request; a daily limit ends the session, other errors offer a retry. */
  private async attempt$(
    generation: number,
    action: () => Promise<void>,
    recover?: Phase,
  ): Promise<void> {
    this.retryAction = null;
    try {
      await action();
    } catch (error) {
      if (generation !== this.runGeneration) {
        return;
      }
      if (errorCodeOf(error) === DAILY_LIMIT_REACHED) {
        this.audio.stop();
        this.phase.set('resting');
        return;
      }
      this.error.set(errorMessage(error));
      if (errorCodeOf(error) === 'RUN_NOT_FOUND') {
        this.retryAction = () => this.start(this.mode(), this.levelId());
        this.phase.set('error');
      } else if (recover) {
        this.retryAction = null;
        this.phase.set(recover);
      } else {
        this.retryAction = action;
        this.phase.set('error');
      }
    }
  }
}
