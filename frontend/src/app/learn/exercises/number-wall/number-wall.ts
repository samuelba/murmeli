import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { WallCell } from '@murmeli/content';
import { BlankEntry } from '../shared/blank-entry';
import { ExerciseBase } from '../shared/exercise-base';
import { Keypad } from '../shared/keypad';
import { KeypadKey } from '../shared/number-entry';
import { Pointer } from '../shared/pointer';

/** Rechenmauer: two bricks side by side make the brick on top of them. */
@Component({
  selector: 'mu-number-wall',
  imports: [TranslocoPipe, Keypad, Pointer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div
        class="wall"
        role="group"
        data-testid="number-wall"
        [attr.aria-label]="'learn.ex.wall.label' | transloco"
        [class.mu-cue]="highlighted('wall', 'numbers')"
      >
        @for (row of rowsTopDown(); track $index) {
          <div class="row">
            @for (cell of row; track cell.id) {
              @if (cell.value !== null) {
                <span
                  class="brick"
                  [attr.aria-label]="
                    ('learn.ex.wall.brick' | transloco: { number: cell.number }) + ': ' + cell.value
                  "
                >
                  {{ cell.value }}
                </span>
              } @else {
                <button
                  type="button"
                  class="brick mu-blank"
                  [class.mu-blank--active]="!locked() && entry.active() === cell.id"
                  [class.mu-blank--filled]="shown(cell.id) !== ''"
                  [class.mu-blank--revealed]="reveal() !== null"
                  [attr.aria-pressed]="entry.active() === cell.id"
                  [attr.aria-label]="
                    ('learn.ex.wall.brick' | transloco: { number: cell.number }) +
                    ': ' +
                    (shown(cell.id) === ''
                      ? ('learn.ex.blank' | transloco)
                      : ('learn.ex.blankFilled' | transloco: { value: shown(cell.id) }))
                  "
                  [attr.data-testid]="'brick-' + cell.id"
                  (click)="select(cell.id)"
                >
                  {{ shown(cell.id) || '?' }}
                  @if (pointing() && reveal() !== null && cell.id === firstBlank()) {
                    <mu-pointer />
                  }
                </button>
              }
            }
          </div>
        }
      </div>
      <mu-keypad
        [locked]="locked()"
        [canSubmit]="entry.canConfirm()"
        [captureKeys]="!locked()"
        (pressed)="press($event)"
      />
      <button
        type="button"
        class="mu-button mu-button--primary mu-ex__check"
        data-testid="check"
        [attr.aria-disabled]="locked() || !entry.complete() ? 'true' : null"
        (click)="check()"
      >
        {{ 'learn.ex.check' | transloco }}
      </button>
    </div>
  `,
  styles: `
    .wall {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .row {
      display: flex;
      gap: 6px;
    }

    .brick {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: clamp(72px, 24vw, 104px);
      min-height: 68px;
      border: 3px solid #7a2e1d;
      border-radius: var(--mu-radius-sm);
      background: linear-gradient(180deg, #e8805f, #c85a3c);
      color: #fff;
      font: 800 2rem/1 var(--mu-font-learn);
      text-shadow: 0 2px 0 rgb(0 0 0 / 0.25);
      box-shadow: inset 0 -5px 0 rgb(0 0 0 / 0.15);
    }

    .brick.mu-blank {
      border: 4px dashed #7a2e1d;
      background: #fff6f0;
      color: #1b1b1b;
      text-shadow: none;

      &.mu-blank--active {
        border-style: solid;
        border-color: var(--mu-color-focus);
      }

      &.mu-blank--revealed {
        border-style: solid;
        border-color: var(--mu-color-success);
      }
    }
  `,
})
export class NumberWall extends ExerciseBase<'number-wall'> {
  protected readonly rowsTopDown = computed(() => {
    const { cells, rows } = this.payload();
    const result: (WallCell & { number: number })[][] = [];
    let number = 1;
    for (let row = rows - 1; row >= 0; row -= 1) {
      result.push(
        cells
          .filter((cell) => cell.row === row)
          .sort((a, b) => a.col - b.col)
          .map((cell) => ({ ...cell, number: number++ })),
      );
    }
    return result;
  });

  private readonly blankIds = computed(() =>
    this.rowsTopDown()
      .flat()
      .filter((cell) => cell.value === null)
      .map((cell) => cell.id),
  );
  protected readonly firstBlank = computed(() => this.blankIds()[0] ?? null);
  protected readonly entry = new BlankEntry(this.blankIds, 3);

  protected shown(id: string): string {
    const revealed = this.reveal()?.values[id];
    return revealed !== undefined ? String(revealed) : this.entry.text(id);
  }

  protected select(id: string): void {
    if (!this.locked()) {
      this.entry.select(id);
    }
  }

  protected press(key: KeypadKey): void {
    if (this.entry.press(key)) {
      this.check();
    }
  }

  protected check(): void {
    if (this.entry.complete()) {
      this.emit({ values: this.entry.values() });
    }
  }
}
