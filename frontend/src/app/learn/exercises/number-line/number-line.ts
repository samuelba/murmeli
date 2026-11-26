import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';
import { ExerciseBase } from '../shared/exercise-base';
import { Pointer } from '../shared/pointer';
import { ValueAnswer } from '../shared/value-answer';

/**
 * A Zahlenstrahl. "missing": a marked tick and number choices. "place": the kid moves a flag
 * to the right tick (tap the line, the arrow buttons or the arrow keys) and checks.
 */
@Component({
  selector: 'mu-number-line',
  imports: [TranslocoPipe, Icon, Pointer, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage line-stage" [class.mu-cue]="highlighted('number-line', 'numbers')">
        <div
          class="line"
          data-testid="number-line"
          [attr.role]="placing() ? 'slider' : 'img'"
          [attr.tabindex]="placing() && !locked() ? 0 : null"
          [attr.aria-label]="
            'learn.ex.line.label' | transloco: { start: payload().start, end: payload().end }
          "
          [attr.aria-valuemin]="placing() ? 1 : null"
          [attr.aria-valuemax]="placing() ? ticks().length : null"
          [attr.aria-valuenow]="placing() && marker() !== null ? marker()! + 1 : null"
          [attr.aria-valuetext]="
            !placing()
              ? null
              : marker() !== null
                ? ('learn.ex.line.tick'
                    | transloco: { number: marker()! + 1, total: ticks().length }) +
                  (moved() || reveal() !== null
                    ? ''
                    : ', ' + ('learn.ex.line.notPlaced' | transloco))
                : ('learn.ex.line.notPlaced' | transloco)
          "
          (click)="tapLine($event)"
          (keydown)="onKey($event)"
        >
          <span class="axis" aria-hidden="true"></span>
          @for (tick of ticks(); track tick.index) {
            <span
              class="tick"
              aria-hidden="true"
              [class.tick--major]="tick.label !== null"
              [style.left.%]="tick.left"
            >
              @if (tick.label !== null) {
                <span class="label" [class.label--low]="dense() && tick.index % 2 === 1">{{
                  tick.label
                }}</span>
              }
            </span>
          }
          @for (hop of hops(); track hop.index) {
            <span
              class="hop"
              aria-hidden="true"
              [style.left.%]="hop.left"
              [style.width.%]="hop.width"
              [style.--i]="hop.index"
            ></span>
          }
          @if (markedLeft() !== null) {
            <span
              class="marked mu-blank"
              data-testid="line-marked"
              [class.mu-blank--revealed]="reveal() !== null"
              [style.left.%]="markedLeft()"
              [attr.aria-label]="'learn.ex.line.marked' | transloco"
            >
              {{ reveal()?.value ?? '?' }}
            </span>
          }
          @if (markerLeft() !== null) {
            <span
              class="flag"
              data-testid="line-flag"
              aria-hidden="true"
              [style.left.%]="markerLeft()"
            >
              <span class="flag__cloth" [class.flag__cloth--revealed]="reveal() !== null"></span>
              @if (pointing()) {
                <mu-pointer />
              }
            </span>
          }
        </div>
      </div>
      @if (placing()) {
        <div class="controls">
          <button
            type="button"
            class="mu-button mu-button--ghost"
            data-testid="line-left"
            [attr.aria-disabled]="locked() ? 'true' : null"
            [attr.aria-label]="'learn.ex.line.left' | transloco"
            (click)="move(-1)"
          >
            <mu-icon name="back" />
          </button>
          <button
            type="button"
            class="mu-button mu-button--primary mu-ex__check"
            data-testid="check"
            [attr.aria-disabled]="locked() || marker() === null ? 'true' : null"
            (click)="check()"
          >
            <mu-icon name="check" />
            {{ 'learn.ex.check' | transloco }}
          </button>
          <button
            type="button"
            class="mu-button mu-button--ghost forward"
            data-testid="line-right"
            [attr.aria-disabled]="locked() ? 'true' : null"
            [attr.aria-label]="'learn.ex.line.right' | transloco"
            (click)="move(1)"
          >
            <mu-icon name="back" />
          </button>
        </div>
      } @else {
        <mu-value-answer
          mode="choices"
          [choices]="payload().choices"
          [locked]="locked()"
          [revealValue]="reveal()?.value ?? null"
          [pointing]="pointing()"
          [highlighted]="highlighted('choices', 'numbers')"
          (answered)="emit({ value: $event })"
        />
      }
    </div>
  `,
  styles: `
    .line-stage {
      padding: var(--mu-space-7) var(--mu-space-5) var(--mu-space-7);
    }

    .line {
      position: relative;
      width: 100%;
      height: 64px;
      container-type: inline-size;
      cursor: pointer;
      touch-action: manipulation;
    }

    .axis {
      position: absolute;
      top: 30px;
      left: -12px;
      right: -12px;
      height: 6px;
      border-radius: 3px;
      background: var(--mu-color-text);
    }

    .tick {
      position: absolute;
      top: 22px;
      width: 3px;
      height: 22px;
      margin-left: -1.5px;
      background: var(--mu-color-text);

      &--major {
        top: 18px;
        width: 5px;
        height: 30px;
        margin-left: -2.5px;
      }
    }

    .label {
      position: absolute;
      top: 34px;
      left: 50%;
      transform: translateX(-50%);
      font: 800 clamp(0.85rem, 4.5cqw, 1.25rem) / 1 var(--mu-font-learn);

      &--low {
        top: 58px;
      }
    }

    .marked {
      position: absolute;
      bottom: 46px;
      min-width: 56px;
      min-height: 56px;
      font-size: 1.75rem;
      transform: translateX(-50%);
    }

    .flag {
      position: absolute;
      bottom: 34px;
      width: 4px;
      height: 52px;
      margin-left: -2px;
      background: var(--mu-color-marmot);
      transition: left var(--mu-motion-base) var(--mu-ease-brand);
    }

    .flag__cloth {
      position: absolute;
      top: 0;
      left: 4px;
      width: 30px;
      height: 22px;
      background: #e5322d;
      clip-path: polygon(0 0, 100% 50%, 0 100%);

      &--revealed {
        background: var(--mu-color-success);
      }
    }

    .hop {
      position: absolute;
      bottom: 36px;
      height: 28px;
      border: 4px solid var(--mu-color-sky-strong);
      border-bottom: 0;
      border-radius: 50% 50% 0 0 / 100% 100% 0 0;
      animation: mu-pop-in 0.35s ease-out both;
      animation-delay: calc(var(--i) * 0.45s);
    }

    .controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-3);
    }

    .forward mu-icon {
      transform: scaleX(-1);
    }
  `,
})
export class NumberLine extends ExerciseBase<'number-line'> {
  private readonly position = signal<number | null>(0);
  /** The flag starts at the first tick; until the kid moves it, it says so. */
  protected readonly moved = computed(() => this.position() !== 0 || this.touched());
  private readonly touched = signal(false);

  protected readonly placing = computed(() => this.payload().mode === 'place');
  protected readonly ticks = computed(() => {
    const { start, end, step, labels } = this.payload();
    const count = Math.round((end - start) / step) + 1;
    return Array.from({ length: count }, (_, index) => {
      const value = start + index * step;
      return {
        index,
        left: count > 1 ? (index / (count - 1)) * 100 : 50,
        label: labels.includes(value) ? value : null,
      };
    });
  });

  protected readonly dense = computed(() => this.ticks().length > 11);

  private readonly revealIndex = computed(() => {
    const value = this.reveal()?.value;
    return value === undefined ? null : this.indexOf(value);
  });

  protected readonly marker = computed(() =>
    this.placing() ? (this.revealIndex() ?? this.position()) : null,
  );
  protected readonly markerLeft = computed(() => this.leftOf(this.marker()));
  protected readonly markedLeft = computed(() => this.leftOf(this.payload().markedTick ?? null));
  protected readonly hops = computed(() => {
    const target = this.revealIndex();
    const ticks = this.ticks();
    if (target === null || this.cue()?.hop !== true) {
      return [];
    }
    return ticks.slice(0, target).map((tick, index) => ({
      index,
      left: tick.left,
      width: ticks[index + 1]!.left - tick.left,
    }));
  });

  protected tapLine(event: MouseEvent): void {
    if (!this.placing() || this.locked()) {
      return;
    }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = box.width > 0 ? (event.clientX - box.left) / box.width : 0;
    const last = this.ticks().length - 1;
    this.touched.set(true);
    this.position.set(Math.max(0, Math.min(last, Math.round(ratio * last))));
  }

  protected move(delta: number): void {
    if (this.locked()) {
      return;
    }
    const last = this.ticks().length - 1;
    this.touched.set(true);
    this.position.update((current) =>
      Math.max(0, Math.min(last, current === null ? (delta > 0 ? 0 : last) : current + delta)),
    );
  }

  protected onKey(event: KeyboardEvent): void {
    if (!this.placing()) {
      return;
    }
    const keys: Record<string, () => void> = {
      ArrowRight: () => this.move(1),
      ArrowUp: () => this.move(1),
      ArrowLeft: () => this.move(-1),
      ArrowDown: () => this.move(-1),
      Home: () => {
        this.touched.set(true);
        this.position.set(0);
      },
      End: () => this.position.set(this.ticks().length - 1),
      Enter: () => this.check(),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      if (!this.locked()) {
        action();
      }
    }
  }

  protected check(): void {
    const position = this.position();
    if (position === null) {
      return;
    }
    const { start, step } = this.payload();
    this.emit({ value: start + position * step });
  }

  private indexOf(value: number): number {
    const { start, step } = this.payload();
    return Math.round((value - start) / step);
  }

  private leftOf(index: number | null): number | null {
    return index === null ? null : (this.ticks()[index]?.left ?? null);
  }
}
