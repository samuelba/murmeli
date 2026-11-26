import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import type { MoneyItem } from '@murmeli/content';
import { moneyUrl } from '../../content/learn-content';

/** One coin or note from `content/pictures/money/`, named by its value. */
@Component({
  selector: 'mu-money-piece',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.note]': "item().kind === 'note'",
    '[attr.data-denomination]': 'item().denomination',
  },
  template: `<img [src]="src()" [alt]="decorative() ? '' : item().label" draggable="false" />`,
  styles: `
    :host {
      display: inline-flex;
      width: var(--mu-coin-size, 64px);
      height: var(--mu-coin-size, 64px);
      flex: none;
    }

    :host(.note) {
      width: calc(var(--mu-coin-size, 64px) * 1.9);
      height: calc(var(--mu-coin-size, 64px) * 0.95);
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      pointer-events: none;
    }
  `,
})
export class MoneyPiece {
  readonly item = input.required<MoneyItem>();
  readonly decorative = input(false, { transform: booleanAttribute });

  protected readonly src = computed(() => moneyUrl(this.item().file));
}
