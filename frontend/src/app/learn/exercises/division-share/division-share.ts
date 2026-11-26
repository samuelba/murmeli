import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LearnContent } from '../../content/learn-content';
import { SHARE_STEP_MS } from '../../player/demo-timing';
import { ExerciseBase } from '../shared/exercise-base';
import { prefersReducedMotion } from '../shared/motion';
import { Picture } from '../shared/picture';
import { Pointer } from '../shared/pointer';
import { ValueAnswer } from '../shared/value-answer';

interface Drag {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Fair sharing: `total` objects onto `groups` plates. The kid may try it out (tap a plate, or
 * drag an object onto it) and answers how many each plate gets.
 */
@Component({
  selector: 'mu-division-share',
  imports: [TranslocoPipe, Picture, Pointer, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage stage">
        <div
          class="basket"
          data-testid="share-basket"
          role="img"
          [attr.aria-label]="'learn.ex.share.basket' | transloco: { count: remaining() }"
          [class.mu-cue]="highlighted('objects', 'picture')"
        >
          @for (item of basket(); track item) {
            <span
              class="item"
              [attr.data-testid]="$first ? 'share-object' : null"
              (pointerdown)="grab($event)"
              (pointermove)="drag($event)"
              (pointerup)="drop($event)"
              (pointercancel)="dragging.set(null)"
            >
              <mu-picture decorative [id]="payload().pictureId" />
            </span>
          } @empty {
            <span class="empty">{{ 'learn.ex.share.empty' | transloco }}</span>
          }
        </div>
        <div
          class="plates"
          role="group"
          [attr.aria-label]="'learn.ex.share.plates' | transloco"
          [class.mu-cue]="highlighted('plates')"
        >
          @for (count of shownPlates(); track $index) {
            <button
              type="button"
              class="plate"
              data-plate
              [attr.data-index]="$index"
              [attr.data-testid]="'plate-' + $index"
              [attr.aria-disabled]="locked() || remaining() === 0 ? 'true' : null"
              [attr.aria-label]="plateLabel($index, count)"
              (click)="place($index)"
            >
              <span class="plate__items" aria-hidden="true">
                @for (item of itemsOf(count); track item) {
                  <mu-picture decorative class="plate__item" [id]="payload().pictureId" />
                }
              </span>
            </button>
          }
        </div>
        @if (!demo() && placedTotal() > 0) {
          <button
            type="button"
            class="mu-button mu-button--ghost"
            data-testid="share-reset"
            (click)="reset()"
          >
            {{ 'learn.ex.share.reset' | transloco }}
          </button>
        }
        <p class="per-plate" [class.mu-cue]="highlighted('numbers', 'prompt')">
          <span
            class="mu-blank"
            data-testid="answer-blank"
            [class.mu-blank--filled]="shown() !== ''"
            [class.mu-blank--revealed]="reveal() !== null"
            [attr.aria-label]="
              shown() === ''
                ? ('learn.ex.blank' | transloco)
                : ('learn.ex.blankFilled' | transloco: { value: shown() })
            "
          >
            {{ shown() || '?' }}
            @if (pointing() && reveal() !== null && payload().answerMode === 'keypad') {
              <mu-pointer />
            }
          </span>
          <span>{{ 'learn.ex.share.perPlate' | transloco }}</span>
        </p>
      </div>
      <p class="mu-visually-hidden" aria-live="polite">{{ status() }}</p>
      <mu-value-answer
        [mode]="payload().answerMode"
        [choices]="payload().choices"
        [locked]="locked()"
        [revealValue]="reveal()?.value ?? null"
        [pointing]="pointing() && payload().answerMode === 'choices'"
        [highlighted]="highlighted('choices')"
        [showBlank]="false"
        (typedChange)="typed.set($event)"
        (answered)="emit({ value: $event })"
      />
      @if (dragging(); as drag) {
        <span class="ghost" aria-hidden="true" [style.left.px]="drag.x" [style.top.px]="drag.y">
          <mu-picture decorative [id]="payload().pictureId" />
        </span>
      }
    </div>
  `,
  styles: `
    .stage {
      flex-direction: column;
      gap: var(--mu-space-3);
    }

    .basket {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 4px;
      min-height: 56px;
      max-width: 520px;
      padding: var(--mu-space-2) var(--mu-space-3);
      border-radius: var(--mu-radius-rounded);
      background: color-mix(in srgb, var(--mu-color-marmot-soft) 70%, var(--mu-color-surface));
    }

    .item {
      display: inline-flex;
      touch-action: none;
      cursor: grab;

      mu-picture {
        width: clamp(26px, 7vw, 36px);
        height: clamp(26px, 7vw, 36px);
      }
    }

    .empty {
      font-weight: 700;
      color: var(--mu-color-text-muted);
    }

    .plates {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-3);
    }

    .plate {
      display: grid;
      place-items: center;
      width: clamp(84px, 24vw, 120px);
      aspect-ratio: 1;
      padding: 14%;
      border: 3px solid var(--mu-color-border-strong);
      border-radius: 50%;
      background: radial-gradient(
        circle,
        var(--mu-color-surface) 0 58%,
        color-mix(in srgb, var(--mu-color-sky) 22%, var(--mu-color-surface)) 60% 100%
      );
      cursor: pointer;
      box-shadow: 0 5px 0 rgb(0 0 0 / 0.18);
      touch-action: manipulation;

      &:active:not([aria-disabled='true']) {
        transform: translateY(3px);
        box-shadow: 0 2px 0 rgb(0 0 0 / 0.18);
      }

      &:focus-visible {
        outline: 5px solid var(--mu-color-focus);
        outline-offset: 3px;
      }

      &[aria-disabled='true'] {
        cursor: default;
      }
    }

    .plate__items {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2px;
    }

    .plate__item {
      width: clamp(18px, 5vw, 26px);
      height: clamp(18px, 5vw, 26px);
      animation: mu-pop-in 0.3s var(--mu-ease-bounce) both;
    }

    .per-plate {
      display: flex;
      align-items: center;
      gap: var(--mu-space-3);
      margin: 0;
      font: 800 1.5rem/1 var(--mu-font-learn);
    }

    .ghost {
      position: fixed;
      z-index: 10;
      width: 48px;
      height: 48px;
      margin: -24px 0 0 -24px;
      pointer-events: none;
      filter: drop-shadow(0 4px 4px rgb(0 0 0 / 0.3));

      mu-picture {
        width: 100%;
        height: 100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .plate__item {
        animation: none;
      }
    }
  `,
})
export class DivisionShare extends ExerciseBase<'division-share'> {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly content = inject(LearnContent);

  protected readonly typed = signal('');
  protected readonly plates = signal<readonly number[]>([]);
  protected readonly dragging = signal<Drag | null>(null);
  protected readonly status = signal('');
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly shown = computed(() => {
    const value = this.reveal()?.value;
    return value !== undefined ? String(value) : this.typed();
  });
  private readonly counts = computed(() =>
    Array.from({ length: this.payload().groups }, (_, index) => this.plates()[index] ?? 0),
  );
  /** The revealed answer fills every plate evenly. */
  protected readonly shownPlates = computed(() => {
    const value = this.reveal()?.value;
    return value !== undefined ? this.counts().map(() => value) : this.counts();
  });
  protected readonly placedTotal = computed(() =>
    this.shownPlates().reduce((sum, count) => sum + count, 0),
  );
  protected readonly remaining = computed(() =>
    Math.max(0, this.payload().total - this.placedTotal()),
  );
  protected readonly basket = computed(() => this.itemsOf(this.remaining()));

  constructor() {
    super();
    effect(() => {
      const sharing = this.countingAlong();
      untracked(() => (sharing ? this.shareAll() : this.stopSharing()));
    });
    inject(DestroyRef).onDestroy(() => this.stopSharing());
  }

  protected itemsOf(count: number): number[] {
    return Array.from({ length: count }, (_, index) => index);
  }

  protected plateLabel(index: number, count: number): string {
    const amount = this.transloco.translate('learn.ex.quantity.objects', {
      count,
      word: this.content.word(this.payload().pictureId),
    });
    return this.transloco.translate('learn.ex.share.plate', { number: index + 1, amount });
  }

  protected place(index: number): void {
    if (this.locked() || this.remaining() === 0) {
      return;
    }
    this.add(index);
    this.status.set(this.plateLabel(index, this.counts()[index]!));
  }

  protected reset(): void {
    if (!this.locked()) {
      this.plates.set([]);
      this.status.set(
        this.transloco.translate('learn.ex.share.basket', { count: this.payload().total }),
      );
    }
  }

  protected grab(event: PointerEvent): void {
    if (this.locked() || this.dragging() || !event.isPrimary) {
      return;
    }
    event.preventDefault();
    try {
      (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    } catch {
      // Without capture the drag still ends on pointerup over the object.
    }
    this.dragging.set({ pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  }

  protected drag(event: PointerEvent): void {
    const drag = this.dragging();
    if (drag?.pointerId === event.pointerId) {
      this.dragging.set({ ...drag, x: event.clientX, y: event.clientY });
    }
  }

  protected drop(event: PointerEvent): void {
    const drag = this.dragging();
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    this.dragging.set(null);
    const plate = this.document
      .elementFromPoint?.(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-plate]');
    const index = Number(plate?.dataset['index']);
    if (plate && Number.isInteger(index)) {
      this.place(index);
    }
  }

  private add(index: number): void {
    this.plates.set(this.counts().map((count, i) => (i === index ? count + 1 : count)));
  }

  /** Murmeli's demo: one object onto each plate in turn until the basket is empty. */
  private shareAll(): void {
    this.stopSharing();
    this.plates.set([]);
    const { total, groups } = this.payload();
    if (prefersReducedMotion(this.document)) {
      this.plates.set(this.counts().map(() => Math.floor(total / groups)));
      return;
    }
    let placed = 0;
    this.timer = setInterval(() => {
      if (placed >= total) {
        this.stopSharing();
        return;
      }
      this.add(placed % groups);
      placed += 1;
    }, SHARE_STEP_MS);
  }

  private stopSharing(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
