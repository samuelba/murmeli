import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';
import { ExerciseBase } from '../shared/exercise-base';
import { Picture } from '../shared/picture';
import { Pointer } from '../shared/pointer';

/** Silben klatschen: one drum beat per syllable, then check. */
@Component({
  selector: 'mu-syllables',
  imports: [TranslocoPipe, Icon, Picture, Pointer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage" [class.mu-cue]="highlighted('picture', 'word')">
        <mu-picture class="hero" data-testid="exercise-picture" [id]="payload().pictureId" />
        @if (payload().word; as word) {
          <p class="word mu-learning-text">{{ word }}</p>
        }
      </div>
      <div
        class="beats"
        aria-hidden="true"
        data-testid="beats"
        [style.--mu-beat-delay]="clapping() ? '0.6s' : '0s'"
      >
        @for (slot of slots(); track slot) {
          <span class="beat" [class.beat--on]="slot < count()" [style.--i]="slot"></span>
        }
      </div>
      <p class="mu-visually-hidden" aria-live="polite" data-testid="beat-count">
        {{ 'learn.ex.syllables.count' | transloco: { count: count() } }}
      </p>
      <div class="drum-row">
        <button
          type="button"
          class="undo mu-button mu-button--ghost"
          data-testid="drum-undo"
          [attr.aria-label]="'learn.ex.syllables.undo' | transloco"
          [attr.aria-disabled]="locked() || taps() === 0 ? 'true' : null"
          (click)="undo()"
        >
          <mu-icon name="backspace" />
        </button>
        <button
          type="button"
          class="drum"
          data-testid="drum"
          [class.drum--clap]="clapping()"
          [class.mu-cue]="highlighted('drum')"
          [style.--beats]="revealCount() ?? 0"
          [attr.aria-label]="'learn.ex.syllables.drum' | transloco"
          [attr.aria-disabled]="locked() || taps() >= payload().maxCount ? 'true' : null"
          (click)="beat()"
        >
          <svg viewBox="0 0 120 100" aria-hidden="true" focusable="false">
            <ellipse cx="60" cy="74" rx="50" ry="18" fill="#a8452e" />
            <rect x="10" y="30" width="100" height="44" fill="#d9634a" />
            <path
              d="M10 34 L35 72 L60 34 L85 72 L110 34"
              fill="none"
              stroke="#f7c600"
              stroke-width="5"
            />
            <ellipse
              cx="60"
              cy="30"
              rx="50"
              ry="18"
              fill="#fff4df"
              stroke="#a8452e"
              stroke-width="4"
            />
          </svg>
          @if (pointing() && revealCount() !== null) {
            <mu-pointer />
          }
        </button>
        <button
          type="button"
          class="mu-button mu-button--primary"
          data-testid="check"
          [attr.aria-disabled]="locked() || taps() === 0 ? 'true' : null"
          (click)="check()"
        >
          {{ 'learn.ex.check' | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .hero {
      width: clamp(110px, 34vw, 160px);
      height: clamp(110px, 34vw, 160px);
    }

    .word {
      margin: 0;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .beats {
      display: flex;
      gap: var(--mu-space-3);
    }

    .beat {
      width: 30px;
      height: 30px;
      border: 4px solid var(--mu-color-marmot);
      border-radius: 50%;

      &--on {
        background: var(--mu-color-marmot);
        animation: mu-pop-in 0.3s var(--mu-ease-bounce) both;
        animation-delay: calc(var(--i) * var(--mu-beat-delay, 0s));
      }
    }

    .drum-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-4);
    }

    .drum {
      position: relative;
      width: 136px;
      height: 120px;
      padding: 8px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      touch-action: manipulation;

      svg {
        width: 100%;
        height: 100%;
      }

      &:active:not([aria-disabled='true']) svg {
        transform: scale(0.92);
      }

      &--clap svg {
        animation: mu-count-pop 0.6s ease-in-out var(--beats);
      }
    }
  `,
})
export class Syllables extends ExerciseBase<'syllables'> {
  protected readonly taps = signal(0);
  protected readonly revealCount = computed(() => this.reveal()?.count ?? null);
  protected readonly count = computed(() => this.revealCount() ?? this.taps());
  protected readonly clapping = computed(
    () => this.cue()?.clap === true && this.revealCount() !== null,
  );
  protected readonly slots = computed(() =>
    Array.from({ length: Math.max(this.payload().maxCount, this.count()) }, (_, index) => index),
  );

  protected beat(): void {
    if (!this.locked() && this.taps() < this.payload().maxCount) {
      this.taps.update((taps) => taps + 1);
    }
  }

  protected undo(): void {
    if (!this.locked()) {
      this.taps.update((taps) => Math.max(0, taps - 1));
    }
  }

  protected check(): void {
    if (this.taps() > 0) {
      this.emit({ count: this.taps() });
    }
  }
}
