import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { Icon } from '../../../shared/icon/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BlankEntry } from '../shared/blank-entry';
import { ExerciseBase } from '../shared/exercise-base';
import { Keypad } from '../shared/keypad';
import { KeypadKey } from '../shared/number-entry';
import { Pointer } from '../shared/pointer';
import { Quantity } from '../shared/quantity';

interface Cell {
  readonly id: string;
  readonly value: number | null;
  readonly blankIndex: number;
}

/** Zahlenhaus: the roof is the whole, each floor holds two parts that make it. */
@Component({
  selector: 'mu-number-bond',
  imports: [NgTemplateOutlet, TranslocoPipe, Icon, Keypad, Pointer, Quantity],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div
        class="house"
        role="group"
        data-testid="number-house"
        [attr.aria-label]="'learn.ex.bond.label' | transloco"
        [class.mu-cue]="highlighted('house', 'numbers')"
      >
        <div class="roof">
          <ng-container
            *ngTemplateOutlet="
              cellView;
              context: { $implicit: roof(), label: 'learn.ex.bond.roof' | transloco }
            "
          />
        </div>
        @for (row of rows(); track $index) {
          <div
            class="floor"
            role="group"
            [attr.aria-label]="'learn.ex.bond.row' | transloco: { number: $index + 1 }"
          >
            <ng-container *ngTemplateOutlet="cellView; context: { $implicit: row[0] }" />
            <ng-container *ngTemplateOutlet="cellView; context: { $implicit: row[1] }" />
          </div>
        }
      </div>
      <ng-template #cellView let-cell let-label="label">
        @if (cell.value !== null) {
          <span class="cell" [attr.aria-label]="label ? label + ': ' + cell.value : null">
            @if (dots() && cell.value <= 10) {
              <mu-quantity kind="dots" [count]="cell.value" />
              <span class="mu-visually-hidden">{{ cell.value }}</span>
            } @else {
              {{ cell.value }}
            }
          </span>
        } @else {
          <button
            type="button"
            class="cell mu-blank"
            [class.mu-blank--active]="!locked() && entry.active() === cell.id"
            [class.mu-blank--filled]="shown(cell) !== ''"
            [class.mu-blank--revealed]="reveal() !== null"
            [attr.aria-pressed]="entry.active() === cell.id"
            [attr.aria-label]="
              (label ? label + ': ' : '') +
              (shown(cell) === ''
                ? ('learn.ex.blank' | transloco)
                : ('learn.ex.blankFilled' | transloco: { value: shown(cell) }))
            "
            [attr.data-testid]="'blank-' + cell.blankIndex"
            (click)="select(cell.id)"
          >
            {{ shown(cell) || '?' }}
            @if (pointing() && reveal() !== null && cell.blankIndex === 0) {
              <mu-pointer />
            }
          </button>
        }
      </ng-template>
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
        <mu-icon name="check" />
        {{ 'learn.ex.check' | transloco }}
      </button>
    </div>
  `,
  styles: `
    .house {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      width: min(100%, 300px);
      filter: drop-shadow(0 6px 0 rgb(0 0 0 / 0.15));
    }

    .roof {
      display: grid;
      place-items: center;
      padding: var(--mu-space-6) 0 var(--mu-space-3);
      background: #d9534f;
      clip-path: polygon(50% 0, 100% 100%, 0 100%);

      .cell {
        min-width: 72px;
        background: #fff6f0;
        color: #1b1b1b;
      }
    }

    .floor {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 4px solid var(--mu-color-ink);
      border-top-width: 0;
      background: #fff6f0;

      &:nth-child(2) {
        border-top-width: 4px;
      }

      > * + * {
        border-left: 4px solid var(--mu-color-ink);
      }
    }

    .cell {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 76px;
      color: #1b1b1b;
      font: 800 2.25rem/1 var(--mu-font-learn);
      --mu-dot-size: 18px;
    }

    .floor .mu-blank {
      margin: 6px;
      border-radius: var(--mu-radius-md);
      background: #fff;
    }
  `,
})
export class NumberBond extends ExerciseBase<'number-bond'> {
  protected readonly dots = computed(() => this.payload().representation === 'dots');

  private readonly cells = computed(() => {
    const { rows, whole } = this.payload();
    let blank = 0;
    const cell = (id: string, value: number | null): Cell => ({
      id,
      value,
      blankIndex: value === null ? blank++ : -1,
    });
    const floors = rows.map((row, index) => [
      cell(`f${index}l`, row.left),
      cell(`f${index}r`, row.right),
    ]);
    return { floors, roof: cell('roof', whole) };
  });

  protected readonly rows = computed(() => this.cells().floors);
  protected readonly roof = computed(() => this.cells().roof);
  private readonly blankIds = computed(() =>
    [...this.cells().floors.flat(), this.cells().roof]
      .filter((cell) => cell.value === null)
      .map((cell) => cell.id),
  );
  protected readonly entry = new BlankEntry(this.blankIds, 2);

  protected shown(cell: Cell): string {
    const revealed = this.reveal()?.values[cell.blankIndex];
    return revealed !== undefined ? String(revealed) : this.entry.text(cell.id);
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

  /** Submits a full house or wall; otherwise moves on to the next empty blank. */
  protected check(): void {
    if (this.locked()) {
      return;
    }
    if (!this.entry.complete()) {
      this.entry.press('ok');
      return;
    }
    const values = this.entry.values();
    this.emit({ values: this.blankIds().map((id) => values[id]!) });
  }
}
