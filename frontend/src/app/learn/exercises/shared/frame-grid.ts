import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/** empty, a counter, an added counter (second color + ring), or a counter taken away (crossed). */
export type FrameCell = 'empty' | 'filled' | 'added' | 'removed';

/** A Zehnerfeld (2 × 5) or Zwanzigerfeld (two of them). Purely visual; the parent names it. */
@Component({
  selector: 'mu-frame-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mu-frame-grid', '[class.counting]': 'counting()' },
  template: `
    @for (frame of frames(); track $index) {
      <div class="frame">
        @for (cell of frame; track cell.index) {
          <span class="cell" [attr.data-state]="cell.state">
            @if (cell.state !== 'empty') {
              <span class="counter" [style.--i]="cell.order" [attr.data-n]="cell.order + 1"></span>
            }
          </span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-3);
      width: 100%;
    }

    .frame {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      width: min(100%, 300px);
      border: 4px solid var(--mu-color-ink);
      border-radius: var(--mu-radius-sm);
      background: var(--mu-color-ink);
      gap: 3px;
    }

    .cell {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1;
      background: #fffdf8;
    }

    .counter {
      position: relative;
      width: 72%;
      height: 72%;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #ff8f8f, #d62828 70%);
      box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.2);
    }

    [data-state='added'] .counter {
      background: radial-gradient(circle at 35% 30%, #8ec5ff, #1f6fb8 70%);
      outline: 3px dashed #1f6fb8;
      outline-offset: 2px;
    }

    [data-state='removed'] .counter {
      opacity: 0.45;

      &::before,
      &::after {
        content: '';
        position: absolute;
        inset: 45% -8%;
        border-radius: 4px;
        background: var(--mu-color-ink);
        transform: rotate(45deg);
      }

      &::after {
        transform: rotate(-45deg);
      }
    }

    :host(.counting) .counter {
      animation: mu-count-pop 0.5s var(--mu-ease-bounce) both;
      animation-delay: calc(var(--i) * 0.6s);

      &::after {
        content: attr(data-n);
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: #fff;
        font: 800 1.1rem/1 var(--mu-font-learn);
      }
    }
  `,
})
export class FrameGrid {
  readonly cells = input.required<readonly FrameCell[]>();
  readonly counting = input(false, { transform: booleanAttribute });

  protected readonly frames = computed(() => {
    let order = 0;
    const cells = this.cells().map((state, index) => ({
      index,
      state,
      order: state === 'empty' ? -1 : order++,
    }));
    const frames = [];
    for (let start = 0; start < cells.length; start += 10) {
      frames.push(cells.slice(start, start + 10));
    }
    return frames;
  });
}

export function filledCells(count: number, size: 10 | 20): FrameCell[] {
  return Array.from({ length: size }, (_, index) => (index < count ? 'filled' : 'empty'));
}
