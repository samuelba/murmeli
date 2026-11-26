import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExerciseBase } from '../shared/exercise-base';
import { Pointer } from '../shared/pointer';
import { ValueAnswer } from '../shared/value-answer';

/** Dots are only offered while they stay countable. */
export const MAX_DOTS = 30;

interface Term {
  readonly key: string;
  readonly value: number | null;
  readonly op?: boolean;
}

interface DotGroup {
  readonly size: number;
  readonly unknown: boolean;
  readonly running: number;
}

/**
 * Einmaleins: a · b = ?, a · ? = c, or the next number of a times-table row. For small
 * products the kid can show the problem as rows of dots (one row per group).
 */
@Component({
  selector: 'mu-times-table',
  imports: [NgTemplateOutlet, TranslocoPipe, Pointer, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage stage">
        @if (row(); as items) {
          <ol
            class="row"
            data-testid="times-row"
            [attr.aria-label]="'learn.ex.times.row' | transloco: { row: payload().row }"
            [class.mu-cue]="highlighted('numbers', 'prompt')"
          >
            @for (item of items; track $index) {
              @if (item === null) {
                <li class="card">
                  <ng-container *ngTemplateOutlet="blank" />
                </li>
              } @else {
                <li class="card">{{ item }}</li>
              }
            }
          </ol>
        } @else {
          <p
            class="equation mu-learning-text"
            data-testid="equation"
            [class.mu-cue]="highlighted('numbers', 'prompt')"
          >
            @for (term of terms(); track term.key) {
              @if (term.op) {
                <span class="term" aria-hidden="true">{{
                  term.key === 'op' ? ('learn.ex.times.sign' | transloco) : '='
                }}</span>
                <span class="mu-visually-hidden">{{
                  term.key === 'op' ? ('learn.ex.times.times' | transloco) : '='
                }}</span>
              } @else if (term.value === null) {
                <ng-container *ngTemplateOutlet="blank" />
              } @else {
                <span class="term">{{ term.value }}</span>
              }
            }
          </p>
        }
        @if (groups().length > 0) {
          @if (!demo()) {
            <button
              type="button"
              class="mu-button mu-button--ghost dots-toggle"
              data-testid="dots-toggle"
              [attr.aria-pressed]="dotsShown()"
              (click)="dotsOpen.update((open) => !open)"
            >
              {{
                (dotsShown() ? 'learn.ex.times.hideDots' : 'learn.ex.times.showDots') | transloco
              }}
            </button>
          }
          @if (dotsShown()) {
            <div
              class="dots"
              data-testid="times-dots"
              aria-hidden="true"
              [class.hopping]="hopping()"
              [class.mu-cue]="highlighted('objects', 'frame')"
            >
              @for (group of groups(); track $index) {
                <div class="group" [class.group--unknown]="group.unknown" [style.--g]="$index">
                  @for (dot of dotsOf(group.size); track dot) {
                    <span class="dot"></span>
                  }
                  @if (hopping()) {
                    <span class="running">{{ group.running }}</span>
                  }
                </div>
              }
            </div>
          }
        }
      </div>
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
    </div>

    <ng-template #blank>
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
        @if (pointing() && reveal() !== null) {
          <mu-pointer />
        }
      </span>
    </ng-template>
  `,
  styles: `
    .stage {
      flex-direction: column;
    }

    .equation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-2) var(--mu-space-3);
      margin: 0;
      font-size: clamp(2.5rem, 1.8rem + 3vw, 3.5rem);
      font-weight: 700;
      line-height: 1;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .card {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
      min-height: 72px;
      padding: 0 var(--mu-space-2);
      border-radius: var(--mu-radius-rounded);
      background: color-mix(in srgb, var(--mu-color-sun) 30%, var(--mu-color-surface));
      font: 800 2rem/1 var(--mu-font-learn);

      .mu-blank {
        min-height: 64px;
      }
    }

    .dots-toggle {
      min-height: var(--mu-touch-target);
    }

    .dots {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--mu-space-2);
      padding: var(--mu-space-3);
      border-radius: var(--mu-radius-rounded);
      background: color-mix(in srgb, var(--mu-color-sky) 12%, var(--mu-color-surface));
    }

    .group {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: var(--mu-radius-pill);
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--mu-color-sky-strong) 45%, transparent);

      &--unknown {
        box-shadow: inset 0 0 0 2px var(--mu-color-sky-strong);
        border: 2px dashed transparent;

        .dot {
          background: transparent;
          box-shadow: inset 0 0 0 2px var(--mu-color-sky-strong);
        }
      }
    }

    .dot {
      width: clamp(14px, 4vw, 26px);
      height: clamp(14px, 4vw, 26px);
      border-radius: 50%;
      background: var(--mu-color-sky-strong);
    }

    .running {
      margin-left: var(--mu-space-2);
      font: 800 1.25rem/1 var(--mu-font-learn);
      color: var(--mu-color-text);
    }

    .hopping .group {
      animation: mu-hop-glow 0.6s ease-out both;
      animation-delay: calc(var(--g) * 0.65s);
    }

    .hopping .running {
      animation: mu-pop-in 0.4s var(--mu-ease-bounce) both;
      animation-delay: calc(var(--g) * 0.65s + 0.2s);
    }

    @keyframes mu-hop-glow {
      0% {
        background: transparent;
      }
      40% {
        background: color-mix(in srgb, var(--mu-color-sun) 60%, transparent);
        transform: translateY(-4px);
      }
      100% {
        background: color-mix(in srgb, var(--mu-color-sun) 25%, transparent);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .hopping .group,
      .hopping .running {
        animation: none;
      }

      .hopping .group {
        background: color-mix(in srgb, var(--mu-color-sun) 25%, transparent);
      }
    }
  `,
})
export class TimesTable extends ExerciseBase<'times-table'> {
  protected readonly typed = signal('');
  protected readonly dotsOpen = signal(false);
  protected readonly shown = computed(() => {
    const value = this.reveal()?.value;
    return value !== undefined ? String(value) : this.typed();
  });
  protected readonly hopping = computed(() => this.cue()?.hop === true);
  protected readonly dotsShown = computed(
    () => this.dotsOpen() || this.hopping() || this.highlighted('objects', 'frame'),
  );

  protected readonly row = computed(() => {
    const payload = this.payload();
    return payload.mode === 'row' ? (payload.items ?? []) : null;
  });

  protected readonly terms = computed<Term[]>(() => {
    const { a, b, product } = this.payload();
    return [
      { key: 'a', value: a },
      { key: 'op', value: null, op: true },
      { key: 'b', value: b },
      { key: 'eq', value: null, op: true },
      { key: 'product', value: product },
    ];
  });

  /** One dot row per group: a · b is a rows of b; a row of the table adds one unknown group. */
  protected readonly groups = computed<DotGroup[]>(() => {
    const payload = this.payload();
    const make = (count: number, size: number, unknownLast = false): DotGroup[] =>
      Array.from({ length: count }, (_, index) => ({
        size,
        unknown: unknownLast && index === count - 1,
        running: size * (index + 1),
      }));
    if (payload.mode === 'row') {
      const step = payload.row ?? 0;
      const known = (payload.items ?? []).filter((item): item is number => item !== null);
      const next = (known.at(-1) ?? 0) + step;
      return step > 0 && next <= MAX_DOTS ? make(next / step, step, true) : [];
    }
    const { a, b, product } = payload;
    if (a === null || a <= 0) {
      return [];
    }
    if (b !== null) {
      return a * b <= MAX_DOTS ? make(a, b) : [];
    }
    return product !== null && product <= MAX_DOTS && product % a === 0 ? make(a, product / a) : [];
  });

  protected dotsOf(size: number): number[] {
    return Array.from({ length: size }, (_, index) => index);
  }
}
