import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AudioService } from '../../core/audio/audio.service';
import { SoundEffects } from '../../core/audio/sound-effects';
import { Icon } from '../../shared/icon/icon';
import { BadgeIcon } from '../badges/badge-icon';
import { BadgeId, badgeNameKey, knownBadges } from '../badges/badges';
import { Mascot, MascotPose } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';
import { FinishRunResponse, RunMode } from '../learn.models';
import { Confetti } from './confetti';
import { Unlocked } from './player-store';

const STAR_DELAY_MS = 450;

/** Stars (never a percentage), what got unlocked, and where to go next. */
@Component({
  selector: 'mu-results',
  imports: [TranslocoPipe, BadgeIcon, Icon, Mascot, Speak, Confetti],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="results" aria-labelledby="results-title" data-testid="results">
      @if (results().stars >= 2) {
        <mu-confetti />
      }
      <mu-mascot class="mascot" [pose]="pose()" />
      <div class="title-row">
        <h1 id="results-title" class="title" tabindex="-1" data-testid="page-title">
          {{ titleKey() | transloco }}
        </h1>
        <mu-speak [text]="titleKey() | transloco" />
      </div>
      <div
        class="stars"
        role="img"
        data-testid="result-stars"
        [attr.data-stars]="results().stars"
        [attr.aria-label]="'learn.results.stars' | transloco: { stars: results().stars }"
      >
        @for (slot of [0, 1, 2]; track slot) {
          <svg
            class="star"
            viewBox="0 0 24 24"
            aria-hidden="true"
            [class.star--on]="slot < results().stars"
            [style.animation-delay.ms]="slot * starDelay"
          >
            <path
              d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
            />
          </svg>
        }
      </div>
      @if (unlocked(); as unlocked) {
        @if (unlocked.newWorlds.length > 0) {
          @for (world of unlocked.newWorlds; track world) {
            <p class="unlock" data-testid="unlocked-world">
              <mu-icon name="success" />
              {{ 'learn.results.newWorld' | transloco: { title: world } }}
            </p>
          }
        } @else if (unlocked.newLevels > 0) {
          <p class="unlock" data-testid="unlocked-level">
            <mu-icon name="success" />
            {{ 'kid.feedback.newLevel' | transloco }}
          </p>
        }
      }
      @if (newBadges().length > 0) {
        <div class="badges" data-testid="new-badges">
          <p class="badges__title">{{ 'kid.badges.new' | transloco }}</p>
          <ul class="badges__list" role="list">
            @for (badge of newBadges(); track badge) {
              <li class="badge" [attr.data-testid]="'new-badge-' + badge">
                <mu-badge-icon [badge]="badge" earned />
                <span>{{ nameKey(badge) | transloco }}</span>
              </li>
            }
          </ul>
        </div>
      }
      <div class="actions">
        @if (unlocked()?.nextLevelId) {
          <button
            type="button"
            class="mu-button mu-button--sun mu-button--big"
            data-testid="results-next"
            (click)="next.emit(unlocked()!.nextLevelId!)"
          >
            <mu-icon name="play" />
            {{ 'kid.navigation.nextLevel' | transloco }}
          </button>
          <mu-speak [text]="'kid.navigation.nextLevel' | transloco" />
        }
        <button
          type="button"
          class="mu-button mu-button--primary"
          data-testid="results-again"
          (click)="again.emit()"
        >
          <mu-icon name="refresh" />
          {{ 'learn.results.again' | transloco }}
        </button>
        <button
          type="button"
          class="mu-button mu-button--ghost"
          data-testid="results-map"
          (click)="map.emit()"
        >
          <mu-icon name="map" />
          {{ 'learn.results.map' | transloco }}
        </button>
      </div>
    </section>
  `,
  styles: `
    .results {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-4);
      padding: var(--mu-space-6) var(--mu-space-4);
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-color-surface);
      box-shadow: var(--mu-shadow-card);
      text-align: center;
    }

    .mascot {
      width: 140px;
      height: 140px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: var(--mu-space-3);
    }

    .title {
      margin: 0;
      font-size: var(--mu-font-size-xl);
      color: var(--mu-color-meadow-strong);
    }

    .stars {
      display: flex;
      gap: var(--mu-space-3);
    }

    .star {
      width: clamp(64px, 20vw, 96px);
      height: clamp(64px, 20vw, 96px);
      fill: none;
      stroke: var(--mu-color-border-strong);
      stroke-width: 1.2;
      stroke-dasharray: 2 1.4;

      &--on {
        fill: var(--mu-color-sun);
        stroke: var(--mu-color-primary-edge);
        stroke-dasharray: none;
        animation: mu-star-in 0.6s var(--mu-ease-bounce) both;
      }
    }

    @keyframes mu-star-in {
      0% {
        transform: scale(0) rotate(-40deg);
      }
      100% {
        transform: scale(1) rotate(0);
      }
    }

    .unlock {
      display: inline-flex;
      align-items: center;
      gap: var(--mu-space-2);
      margin: 0;
      padding: var(--mu-space-2) var(--mu-space-4);
      border-radius: var(--mu-radius-pill);
      background: color-mix(in srgb, var(--mu-color-sun) 35%, var(--mu-color-surface));
      font-weight: 800;
    }

    .badges {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-2);
      padding: var(--mu-space-3) var(--mu-space-4);
      border: 3px solid var(--mu-color-primary-edge);
      border-radius: var(--mu-radius-md);
      background: color-mix(in srgb, var(--mu-color-sun) 22%, var(--mu-color-surface));
    }

    .badges__title {
      margin: 0;
      font-size: var(--mu-font-size-lg);
      font-weight: 800;
    }

    .badges__list {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-4);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-1);
      font-weight: 800;

      mu-badge-icon {
        width: 88px;
        height: 88px;
        animation: mu-star-in 0.6s var(--mu-ease-bounce) both;
        animation-delay: 1.2s;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .badge mu-badge-icon {
        animation: none;
      }
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-3);
    }
  `,
})
export class Results {
  private readonly transloco = inject(TranslocoService);
  private readonly audio = inject(AudioService);
  private readonly effects = inject(SoundEffects);
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  readonly results = input.required<FinishRunResponse>();
  readonly unlocked = input<Unlocked | null>(null);
  readonly mode = input<RunMode>('level');
  readonly next = output<string>();
  readonly again = output<void>();
  readonly map = output<void>();

  protected readonly starDelay = STAR_DELAY_MS;
  protected readonly titleKey = computed(() => {
    if (this.mode() === 'practice') {
      return 'kid.feedback.practiced';
    }
    return [
      'kid.feedback.practiced',
      'kid.feedback.onePoint',
      'kid.feedback.passed',
      'kid.feedback.allStars',
    ][this.results().stars]!;
  });
  protected readonly newBadges = computed(() => knownBadges(this.results().newBadges));
  protected readonly nameKey = badgeNameKey;
  protected readonly pose = computed<MascotPose>(() =>
    this.results().stars >= 2 ? 'cheering' : this.results().stars === 1 ? 'happy' : 'encouraging',
  );

  constructor() {
    queueMicrotask(() => this.celebrate());
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  private celebrate(): void {
    for (let star = 0; star < this.results().stars; star += 1) {
      this.timers.push(setTimeout(() => this.effects.play('star'), star * STAR_DELAY_MS));
    }
    const lines = [this.transloco.translate(this.titleKey())];
    const unlocked = this.unlocked();
    if (unlocked?.newWorlds.length) {
      lines.push(this.transloco.translate('kid.feedback.newWorld'));
    } else if (unlocked?.newLevels) {
      lines.push(this.transloco.translate('kid.feedback.newLevel'));
    }
    const badges: readonly BadgeId[] = this.newBadges();
    if (badges.length > 0) {
      lines.push(this.transloco.translate('kid.badges.new'));
      badges.forEach((badge) => lines.push(this.transloco.translate(badgeNameKey(badge))));
    }
    if (unlocked?.nextLevelId) {
      lines.push(this.transloco.translate('kid.navigation.nextLevel'));
    }
    void this.audio.narrate(lines);
  }
}
