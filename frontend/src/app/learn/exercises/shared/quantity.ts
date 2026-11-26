import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { Fingers } from './fingers';
import { FrameGrid, filledCells } from './frame-grid';
import { Picture } from './picture';

export type QuantityKind = 'dots' | 'fingers' | 'frame' | 'objects';

/** Shows a small amount as dots (in fives), fingers, a ten-frame or pictures. Decorative. */
@Component({
  selector: 'mu-quantity',
  imports: [Fingers, FrameGrid, Picture],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.counting]': 'counting()' },
  template: `
    @switch (kind()) {
      @case ('fingers') {
        <mu-fingers [count]="count()" />
      }
      @case ('frame') {
        <mu-frame-grid [cells]="cells()" [counting]="counting()" />
      }
      @default {
        <div class="rows">
          @for (row of rows(); track $index) {
            <div class="row">
              @for (item of row; track item) {
                @if (kind() === 'objects' && pictureId()) {
                  <mu-picture class="item" decorative [id]="pictureId()!" [style.--i]="item" />
                } @else {
                  <span class="item dot" [style.--i]="item"></span>
                }
              }
            </div>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
    }

    :host:has(mu-frame-grid) {
      width: 100%;
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .row {
      display: flex;
      gap: 6px;
      justify-content: center;
    }

    .dot {
      width: var(--mu-dot-size, 22px);
      height: var(--mu-dot-size, 22px);
      border-radius: 50%;
      background: var(--mu-color-marmot);
      box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.2);
    }

    mu-picture.item {
      width: var(--mu-object-size, 36px);
      height: var(--mu-object-size, 36px);
    }

    :host(.counting) .item {
      animation: mu-count-pop 0.5s var(--mu-ease-bounce) both;
      animation-delay: calc(var(--i) * 0.6s);
    }
  `,
})
export class Quantity {
  readonly kind = input<QuantityKind>('dots');
  readonly count = input.required<number>();
  readonly pictureId = input<string | null>(null);
  readonly counting = input(false, { transform: booleanAttribute });
  readonly perRow = input(5);

  protected readonly rows = computed(() => {
    const items = Array.from({ length: Math.max(0, this.count()) }, (_, index) => index);
    const rows: number[][] = [];
    const perRow = Math.max(1, this.perRow());
    for (let start = 0; start < items.length; start += perRow) {
      rows.push(items.slice(start, start + perRow));
    }
    return rows;
  });

  protected readonly cells = computed(() => filledCells(this.count(), this.count() > 10 ? 20 : 10));
}
