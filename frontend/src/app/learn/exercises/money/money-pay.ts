import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { MoneyItem } from '@murmeli/content';
import { Icon } from '../../../shared/icon/icon';
import { COIN_STEP_MS } from '../../player/demo-timing';
import { ExerciseBase } from '../shared/exercise-base';
import { Pointer } from '../shared/pointer';
import { formatMoney } from './money-format';
import { MoneyPiece } from './money-piece';

/** The answer schema allows at most 30 coins. */
export const MAX_TRAY = 30;

interface Placed {
  readonly key: number;
  readonly item: MoneyItem;
}

/**
 * "Lege genau 7 Franken hin.": tap coins and notes from the wallet (one of each, unlimited)
 * into the tray, tap a tray piece to take it back, then pay. No running sum: no param asks
 * for one, and adding up is the task.
 */
@Component({
  selector: 'mu-money-pay',
  imports: [TranslocoPipe, Icon, MoneyPiece, Pointer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex__stage stage">
      <p class="price" data-testid="money-price" [class.mu-cue]="highlighted('prompt', 'numbers')">
        {{ price() }}
      </p>
      <ul
        class="tray"
        data-testid="money-tray"
        [attr.aria-label]="'learn.ex.money.tray' | transloco"
        [class.mu-cue]="highlighted('money')"
        [class.placing]="placing()"
      >
        @for (entry of tray(); track entry.key; let i = $index) {
          <li [style.--i]="i" [style.--step]="coinStep">
            <button
              type="button"
              class="piece-button"
              [attr.data-testid]="'tray-' + i"
              [attr.aria-disabled]="locked() || revealedCoins() !== null ? 'true' : null"
              [attr.aria-label]="'learn.ex.money.takeBack' | transloco: { label: entry.item.label }"
              (click)="takeBack(i)"
            >
              <mu-money-piece decorative [item]="entry.item" />
            </button>
            @if (pointing() && revealedCoins() !== null && $last) {
              <mu-pointer />
            }
          </li>
        } @empty {
          <li class="tray__empty">{{ 'learn.ex.money.trayEmpty' | transloco }}</li>
        }
      </ul>
    </div>
    <p class="mu-visually-hidden" aria-live="polite" data-testid="money-status">{{ status() }}</p>
    <div
      class="wallet"
      role="group"
      [attr.aria-label]="'learn.ex.money.wallet' | transloco"
      [class.mu-cue]="highlighted('choices')"
    >
      @for (item of wallet(); track item.denomination) {
        <button
          type="button"
          class="piece-button wallet__piece"
          [attr.data-testid]="'wallet-' + item.denomination"
          [attr.aria-disabled]="locked() || placed().length >= maxTray ? 'true' : null"
          [attr.aria-label]="'learn.ex.money.put' | transloco: { label: item.label }"
          (click)="put(item)"
        >
          <mu-money-piece decorative [item]="item" />
        </button>
      }
    </div>
    <button
      type="button"
      class="mu-button mu-button--primary mu-ex__check"
      data-testid="check"
      [attr.aria-disabled]="locked() || placed().length === 0 ? 'true' : null"
      (click)="pay()"
    >
      <mu-icon name="check" />
      {{ 'learn.ex.money.pay' | transloco }}
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }

    .stage {
      flex-direction: column;
    }

    .price {
      margin: 0;
      padding: var(--mu-space-2) var(--mu-space-5);
      border: 3px solid var(--mu-color-signpost-black);
      border-radius: var(--mu-radius-md);
      background: var(--mu-color-signpost-yellow);
      color: var(--mu-color-signpost-black);
      font: 800 clamp(2rem, 1.6rem + 2vw, 2.75rem) / 1.1 var(--mu-font-learn);
      transform: rotate(-2deg);
    }

    .tray {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-2);
      width: min(100%, 520px);
      min-height: 104px;
      margin: 0;
      padding: var(--mu-space-3);
      list-style: none;
      border: 3px dashed var(--mu-color-border-strong);
      border-radius: var(--mu-radius-rounded);
      background: color-mix(in srgb, var(--mu-color-marmot-soft) 75%, var(--mu-color-surface));
      --mu-coin-size: clamp(48px, 13vw, 60px);

      li {
        position: relative;
        display: inline-flex;
      }
    }

    .tray__empty {
      color: var(--mu-color-text-muted);
      font-weight: 700;
    }

    .placing li {
      animation: mu-coin-in 0.45s var(--mu-ease-bounce) both;
      animation-delay: calc(var(--i) * var(--step) * 1ms);
    }

    .piece-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
      min-height: 64px;
      padding: 2px;
      border: 0;
      border-radius: var(--mu-radius-md);
      background: transparent;
      cursor: pointer;
      touch-action: manipulation;

      &:focus-visible {
        outline: 5px solid var(--mu-color-focus);
        outline-offset: 2px;
      }

      &:active:not([aria-disabled='true']) {
        transform: translateY(3px) scale(0.96);
      }

      &[aria-disabled='true'] {
        cursor: default;
      }
    }

    .wallet {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-2);
      width: 100%;
      padding: var(--mu-space-3);
      border-radius: var(--mu-radius-chunky);
      background: color-mix(in srgb, var(--mu-color-meadow) 22%, var(--mu-color-surface));
      box-shadow: inset 0 0 0 3px var(--mu-color-border);
      --mu-coin-size: clamp(56px, 15vw, 72px);
    }

    .wallet__piece {
      filter: drop-shadow(0 3px 0 rgb(0 0 0 / 0.25));
    }

    @keyframes mu-coin-in {
      0% {
        opacity: 0;
        transform: translateY(80px) scale(0.6);
      }
      100% {
        opacity: 1;
        transform: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .placing li {
        animation: none;
      }
    }
  `,
})
export class MoneyPay extends ExerciseBase<'money-chf'> {
  private readonly transloco = inject(TranslocoService);

  protected readonly maxTray = MAX_TRAY;
  protected readonly coinStep = COIN_STEP_MS;
  protected readonly placed = signal<readonly Placed[]>([]);
  protected readonly status = signal('');
  private nextKey = 0;

  protected readonly wallet = computed(() => {
    const payload = this.payload();
    return payload.mode === 'pay' ? payload.wallet : [];
  });
  protected readonly price = computed(() => {
    const payload = this.payload();
    return payload.mode === 'pay'
      ? formatMoney(payload.amount, payload.currency, payload.group)
      : '';
  });
  protected readonly revealedCoins = computed(() => {
    const reveal = this.reveal();
    return reveal && 'coins' in reveal ? reveal.coins : null;
  });
  /** The revealed coins (Murmeli's demo or the solution) replace what the kid put down. */
  protected readonly tray = computed<readonly Placed[]>(() => {
    const coins = this.revealedCoins();
    if (coins === null) {
      return this.placed();
    }
    const byId = new Map(this.wallet().map((item) => [item.denomination, item]));
    return coins.flatMap((id, key) => {
      const item = byId.get(id);
      return item ? [{ key, item }] : [];
    });
  });
  protected readonly placing = computed(
    () => this.revealedCoins() !== null && this.cue()?.placeCoins === true,
  );

  protected put(item: MoneyItem): void {
    if (this.locked() || this.placed().length >= MAX_TRAY) {
      return;
    }
    this.placed.update((placed) => [...placed, { key: this.nextKey++, item }]);
    this.announce();
  }

  protected takeBack(index: number): void {
    if (this.locked() || this.revealedCoins() !== null) {
      return;
    }
    this.placed.update((placed) => placed.filter((_, i) => i !== index));
    this.announce();
  }

  protected pay(): void {
    const coins = this.placed().map((entry) => entry.item.denomination);
    if (coins.length > 0) {
      this.emit({ coins });
    }
  }

  private announce(): void {
    const labels = this.placed().map((entry) => entry.item.label);
    this.status.set(
      labels.length === 0
        ? this.transloco.translate('learn.ex.money.trayEmpty')
        : `${this.transloco.translate('learn.ex.money.tray')}: ${labels.join(', ')}`,
    );
  }
}
