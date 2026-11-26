import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LearnContent } from '../../content/learn-content';
import { ExerciseBase } from '../shared/exercise-base';
import { Picture } from '../shared/picture';
import { ValueAnswer } from '../shared/value-answer';

/** Counts pictures laid out on the board. Tapping a picture marks it as counted (1, 2, 3 …). */
@Component({
  selector: 'mu-count-objects',
  imports: [TranslocoPipe, Picture, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div
        class="board mu-ex__stage"
        role="group"
        data-testid="count-board"
        [attr.aria-label]="'learn.ex.count.objects' | transloco: { count: objects().length }"
        [class.mu-cue]="highlighted('objects', 'picture')"
        [class.counting]="countingAlong()"
        [style.aspect-ratio]="aspect()"
      >
        @for (object of objects(); track $index) {
          <button
            type="button"
            class="object"
            [style.left.%]="object.x * 100"
            [style.top.%]="object.y * 100"
            [style.width.%]="size()"
            [style.--i]="$index"
            [class.counted]="countOf($index) !== null"
            [attr.aria-pressed]="countOf($index) !== null"
            [attr.aria-label]="word()"
            [attr.data-testid]="'count-object-' + $index"
            (click)="toggle($index)"
          >
            <mu-picture decorative [id]="object.pictureId" />
            @if (countOf($index); as number) {
              <span class="badge" aria-hidden="true">{{ number }}</span>
            } @else if (countingAlong()) {
              <span class="badge badge--along" aria-hidden="true">{{ $index + 1 }}</span>
            }
          </button>
        }
      </div>
      <p class="mu-visually-hidden" aria-live="polite" data-testid="count-total">
        {{ 'learn.ex.count.total' | transloco: { count: counted().length } }}
      </p>
      <mu-value-answer
        [mode]="payload().answerMode"
        [choices]="payload().choices"
        [locked]="locked()"
        [revealValue]="reveal()?.value ?? null"
        [pointing]="pointing()"
        [highlighted]="highlighted('choices', 'numbers')"
        (answered)="emit({ value: $event })"
      />
    </div>
  `,
  styles: `
    .board {
      position: relative;
      max-width: 560px;
      max-height: 46vh;
      padding: 0;
      background:
        radial-gradient(circle at 20% 15%, var(--mu-board-glow), transparent 40%),
        linear-gradient(180deg, var(--mu-board-a), var(--mu-board-b));
    }

    .object {
      position: absolute;
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      min-width: 44px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      transform: translate(-50%, -50%);
      touch-action: manipulation;

      mu-picture {
        width: 86%;
        height: 86%;
        filter: drop-shadow(0 3px 0 rgb(0 0 0 / 0.15));
      }

      &.counted {
        background: rgb(255 255 255 / 0.75);
        box-shadow: 0 0 0 3px var(--mu-color-sky-deep);
      }
    }

    .badge {
      position: absolute;
      top: -6px;
      right: -6px;
      display: grid;
      place-items: center;
      min-width: 28px;
      height: 28px;
      border-radius: 14px;
      background: var(--mu-color-sky-deep);
      color: #fff;
      font: 800 1rem/1 var(--mu-font-learn);
    }

    .counting .object {
      animation: mu-count-pop 0.5s var(--mu-ease-bounce) both;
      animation-delay: calc(var(--i) * 0.7s);
    }

    .badge--along {
      animation: mu-pop-in 0.3s ease-out both;
      animation-delay: calc(var(--i) * 0.7s);
    }
  `,
})
export class CountObjects extends ExerciseBase<'count-objects'> {
  private readonly content = inject(LearnContent);
  protected readonly counted = signal<readonly number[]>([]);

  /** Line and ten-frame layouts fill columns from the left; center the group on the board. */
  protected readonly objects = computed(() => {
    const { objects, arrangement } = this.payload();
    if (objects.length === 0 || (arrangement !== 'line' && arrangement !== 'ten-frame')) {
      return objects;
    }
    const xs = objects.map((object) => object.x);
    const shift = 0.5 - (Math.min(...xs) + Math.max(...xs)) / 2;
    return objects.map((object) => ({ ...object, x: object.x + shift }));
  });
  protected readonly word = computed(() => this.content.word(this.objects()[0]?.pictureId ?? ''));
  protected readonly grid = computed(() => {
    const objects = this.objects();
    const columns = new Set(objects.map((object) => object.x)).size;
    const rows = new Set(objects.map((object) => object.y)).size;
    switch (this.payload().arrangement) {
      case 'scattered':
        return { columns: 6, rows: 4 };
      case 'dice':
        return { columns: 3, rows: 3 };
      default:
        return { columns: Math.max(5, columns), rows: Math.max(1, rows) };
    }
  });
  protected readonly aspect = computed(() => {
    const { columns, rows } = this.grid();
    return `${columns} / ${Math.max(rows, columns >= 5 ? 1.6 : rows)}`;
  });
  protected readonly size = computed(() => Math.min(30, 88 / this.grid().columns));

  protected countOf(index: number): number | null {
    const position = this.counted().indexOf(index);
    return position < 0 ? null : position + 1;
  }

  protected toggle(index: number): void {
    if (this.locked()) {
      return;
    }
    this.counted.update((counted) =>
      counted.includes(index) ? counted.filter((item) => item !== index) : [...counted, index],
    );
  }
}
