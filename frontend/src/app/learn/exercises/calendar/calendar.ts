import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { CalendarChoice } from '@murmeli/content';
import { Icon } from '../../../shared/icon/icon';
import { Speak } from '../../../shared/speak/speak';
import { ExerciseBase } from '../shared/exercise-base';
import { Pointer } from '../shared/pointer';
import { ringSteps } from './calendar-math';
import { CalendarScene } from './calendar-scene';
import type { SceneUnit } from './calendar-scene';

const WEEKEND = new Set([5, 6]);

/** Weekdays, months and seasons: a strip or calendar page, or a drawn scene, and the names to choose from. */
@Component({
  selector: 'mu-calendar',
  imports: [TranslocoPipe, Icon, Speak, Pointer, CalendarScene],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex layout">
      <div
        class="mu-ex__stage stage"
        data-testid="calendar-stage"
        [class.mu-cue]="highlighted('calendar', 'picture')"
      >
        @if (sceneUnit(); as unit) {
          <mu-calendar-scene [unit]="unit" [index]="payload().scene ?? 0" />
        } @else if (payload().ring.length > 0) {
          <ol
            class="ring"
            data-testid="calendar-ring"
            [attr.data-unit]="payload().unit"
            [attr.aria-label]="'learn.ex.calendar.strip.' + payload().unit | transloco"
          >
            @for (card of payload().ring; track card.index; let i = $index) {
              <li
                class="card"
                [class.card--focus]="card.index === payload().focus"
                [class.card--gap]="card.label === null"
                [class.card--weekend]="isWeekend(card.index)"
                [class.card--count]="i < countTo()"
                [style.--i]="i"
                [style.--mu-card-tint]="tint(card.index)"
                [attr.data-testid]="'card-' + card.index"
              >
                @if (card.label === null) {
                  <span class="card__name" aria-hidden="true">?</span>
                  <span class="mu-visually-hidden">{{ 'learn.ex.calendar.gap' | transloco }}</span>
                } @else {
                  <span class="card__name">{{ card.label }}</span>
                }
                @if (card.index === payload().focus && payload().relation) {
                  <span class="mu-visually-hidden">, </span>
                  <span class="today">{{ 'learn.ex.calendar.today' | transloco }}</span>
                }
              </li>
            }
          </ol>
        } @else if (payload().name; as name) {
          <div class="page" data-testid="calendar-page">
            <span class="page__name">{{ name }}</span>
            @if (payload().relation) {
              <span class="mu-visually-hidden">, </span>
              <span class="today page__today">{{ 'learn.ex.calendar.today' | transloco }}</span>
            }
          </div>
        }
      </div>
      <ul
        class="choices"
        [attr.aria-label]="'learn.ex.answers' | transloco"
        [class.mu-cue]="highlighted('choices')"
      >
        @for (choice of payload().choices; track choice.id; let i = $index) {
          <li class="option">
            <button
              type="button"
              class="mu-choice choice"
              [class.mu-choice--selected]="choice.id === picked()"
              [class.mu-choice--revealed]="choice.id === revealId()"
              [attr.aria-disabled]="locked() ? 'true' : null"
              [attr.aria-label]="ariaLabel(choice)"
              [attr.data-testid]="'choice-' + choice.id"
              [attr.data-value]="choice.label"
              [style.--mu-choice-tint]="'var(--mu-avatar-bg-' + ((i % 9) + 1) + ')'"
              (click)="pick(choice.id)"
            >
              {{ choice.label }}
              @if (choice.id === revealId()) {
                <span class="mu-choice__badge"><mu-icon name="check" /></span>
                @if (pointing()) {
                  <mu-pointer />
                }
              }
            </button>
            <mu-speak [text]="choice.label" />
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .stage {
      width: 100%;
      justify-content: center;
    }

    .ring {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
      gap: var(--mu-space-2);
      width: min(100%, 760px);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .ring[data-unit='month'] {
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    }

    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      min-height: 64px;
      padding: var(--mu-space-2) var(--mu-space-1);
      border: 3px solid var(--mu-color-signpost-black);
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-card-tint);
      color: var(--mu-color-signpost-black);
      min-width: 0;
      font: 800 clamp(0.95rem, 0.85rem + 0.4vw, 1.05rem) / 1.1 var(--mu-font-learn);
      text-align: center;
      overflow-wrap: break-word;
      hyphens: manual;
    }

    .card--weekend {
      background: repeating-linear-gradient(
        -45deg,
        var(--mu-card-tint) 0 8px,
        color-mix(in srgb, var(--mu-card-tint) 70%, white) 8px 16px
      );
    }

    .card--focus {
      box-shadow:
        0 0 0 3px var(--mu-color-signpost-black),
        0 0 0 9px var(--mu-color-sun);
      transform: scale(1.06);
    }

    .card--gap {
      border-style: dashed;
      background: var(--mu-color-surface);
      font-size: 2rem;
    }

    .card--count {
      animation: mu-count-pop 0.5s var(--mu-ease-bounce) both;
      animation-delay: calc(var(--i) * 0.7s);
    }

    .today {
      padding: 0 var(--mu-space-1);
      border-radius: var(--mu-radius-pill);
      background: var(--mu-color-signpost-yellow);
      font-size: 1rem;
      font-weight: 800;
    }

    .page__today {
      order: -1;
    }

    .page {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-2);
      min-width: 200px;
      min-height: 160px;
      padding: var(--mu-space-5) var(--mu-space-4) var(--mu-space-4);
      border: 3px solid var(--mu-color-signpost-black);
      border-top-width: 24px;
      border-top-color: var(--mu-color-error);
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-color-surface);
      box-shadow: 0 6px 0 rgb(0 0 0 / 0.2);
    }

    .page__name {
      font: 800 clamp(1.8rem, 1.4rem + 2vw, 2.6rem) / 1 var(--mu-font-learn);
    }

    .choices {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-3);
      width: min(100%, 420px);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .option {
      display: flex;
      align-items: center;
      gap: var(--mu-space-2);
    }

    .choice {
      flex: 1;
      min-height: 72px;
      font-size: clamp(1.3rem, 1.1rem + 1vw, 1.6rem);
      line-height: 1.15;
      text-align: center;
    }

    @media (prefers-reduced-motion: reduce) {
      .card--count {
        animation: none;
        outline: 4px dashed var(--mu-color-sky-strong);
        outline-offset: 3px;
      }

      .card--focus {
        transform: none;
      }
    }
  `,
})
export class Calendar extends ExerciseBase<'calendar'> {
  private readonly transloco = inject(TranslocoService);
  protected readonly picked = signal<string | null>(null);
  protected readonly revealId = computed(() => this.reveal()?.choiceId ?? null);

  protected readonly sceneUnit = computed<SceneUnit | null>(() => {
    const { unit, scene } = this.payload();
    return scene !== null && (unit === 'daytime' || unit === 'season') ? unit : null;
  });

  protected readonly countTo = computed(() => {
    if (!this.countingAlong()) {
      return 0;
    }
    const { ring, focus, gap } = this.payload();
    return ringSteps(ring, focus ?? gap);
  });

  protected isWeekend(index: number): boolean {
    return this.payload().unit === 'weekday' && WEEKEND.has(index);
  }

  protected tint(index: number): string {
    return `var(--mu-avatar-bg-${(index % 9) + 1})`;
  }

  protected ariaLabel(choice: CalendarChoice): string {
    return choice.id === this.revealId()
      ? `${choice.label}, ${this.transloco.translate('learn.player.correctLabel')}`
      : choice.label;
  }

  protected pick(id: string): void {
    if (this.locked()) {
      return;
    }
    this.picked.set(id);
    this.emit({ choiceId: id });
  }
}
