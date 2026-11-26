import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { MoneyItem } from '@murmeli/content';
import { Icon } from '../../../shared/icon/icon';
import { COIN_STEP_MS } from '../../player/demo-timing';
import { ExerciseBase } from '../shared/exercise-base';
import { Pointer } from '../shared/pointer';
import { ValueAnswer } from '../shared/value-answer';
import { formatMoney, unitParts } from './money-format';
import { MoneyPiece } from './money-piece';

type Relation = 'lt' | 'eq' | 'gt';

const SIGNS: Readonly<Record<Relation, string>> = { lt: '<', eq: '=', gt: '>' };
/** The answer schema allows at most 30 coins. */
export const MAX_TRAY = 30;

interface Placed {
  readonly key: number;
  readonly item: MoneyItem;
}

/**
 * Swiss francs and Rappen (or dollars and cents): count the money (total), pay an amount by
 * tapping coins from the wallet into the tray (pay), or say which purse holds more (compare).
 */
@Component({
  selector: 'mu-money-chf',
  imports: [TranslocoPipe, Icon, MoneyPiece, Pointer, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      @switch (payload().mode) {
        @case ('total') {
          <div class="mu-ex__stage stage">
            <ul
              class="purse"
              data-testid="money-items"
              [attr.aria-label]="'learn.ex.money.money' | transloco"
              [class.mu-cue]="highlighted('money', 'objects')"
              [class.counting]="countingAlong()"
            >
              @for (item of items(); track $index) {
                <li [style.--i]="$index"><mu-money-piece [item]="item" /></li>
              }
            </ul>
            <p class="amount" [class.mu-cue]="highlighted('numbers', 'prompt')">
              @if (unit().before) {
                <span aria-hidden="true">{{ unit().before }}</span>
              }
              <span
                class="mu-blank"
                data-testid="answer-blank"
                [class.mu-blank--filled]="shown() !== ''"
                [class.mu-blank--revealed]="reveal() !== null"
                [attr.aria-label]="
                  shown() === ''
                    ? ('learn.ex.blank' | transloco)
                    : ('learn.ex.blankFilled' | transloco: { value: shownMoney() })
                "
              >
                {{ shown() || '?' }}
                @if (pointing() && revealValue() !== null && totalMode() === 'keypad') {
                  <mu-pointer />
                }
              </span>
              @if (unit().after) {
                <span aria-hidden="true">{{ unit().after }}</span>
              }
            </p>
          </div>
          <mu-value-answer
            [mode]="totalMode()"
            [choices]="totalChoices()"
            [locked]="locked()"
            [revealValue]="revealValue()"
            [pointing]="pointing() && totalMode() === 'choices'"
            [highlighted]="highlighted('choices')"
            [showBlank]="false"
            (typedChange)="typed.set($event)"
            (answered)="emit({ value: $event })"
          />
        }
        @case ('pay') {
          <div class="mu-ex__stage stage">
            <p
              class="price"
              data-testid="money-price"
              [class.mu-cue]="highlighted('prompt', 'numbers')"
            >
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
                    [attr.aria-label]="
                      'learn.ex.money.takeBack' | transloco: { label: entry.item.label }
                    "
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
          <p class="mu-visually-hidden" aria-live="polite" data-testid="money-status">
            {{ status() }}
          </p>
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
                [attr.aria-disabled]="locked() || tray().length >= maxTray ? 'true' : null"
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
            {{ 'learn.ex.money.pay' | transloco }}
          </button>
        }
        @case ('compare') {
          <div class="mu-ex__stage scene" [class.mu-cue]="highlighted('money', 'objects')">
            @for (side of sides(); track side.key) {
              <ul
                class="purse purse--side"
                [attr.aria-label]="side.label"
                [attr.data-testid]="'money-' + side.key"
                [class.counting]="countingAlong()"
              >
                @for (item of side.items; track $index) {
                  <li [style.--i]="$index"><mu-money-piece [item]="item" /></li>
                }
              </ul>
              @if ($first) {
                <span
                  class="slot mu-blank"
                  aria-hidden="true"
                  [class.mu-blank--filled]="relation() !== null"
                  [class.mu-blank--revealed]="reveal() !== null"
                >
                  {{ relation() ? signs[relation()!] : '?' }}
                </span>
              }
            }
          </div>
          <div
            class="signs"
            role="group"
            [attr.aria-label]="'learn.ex.answers' | transloco"
            [class.mu-cue]="highlighted('signs', 'choices')"
          >
            @for (option of relations; track option) {
              <button
                type="button"
                class="mu-choice"
                [class.mu-choice--selected]="picked() === option"
                [class.mu-choice--revealed]="revealedRelation() === option"
                [attr.aria-disabled]="locked() ? 'true' : null"
                [attr.aria-label]="'learn.ex.relation.' + option | transloco"
                [attr.data-testid]="'relation-' + option"
                (click)="choose(option)"
              >
                <span aria-hidden="true">{{ signs[option] }}</span>
                @if (revealedRelation() === option) {
                  <span class="mu-choice__badge"><mu-icon name="check" /></span>
                  @if (pointing()) {
                    <mu-pointer />
                  }
                }
              </button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .stage {
      flex-direction: column;
    }

    .purse,
    .tray {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-2);
      margin: 0;
      padding: var(--mu-space-3);
      list-style: none;
      border-radius: var(--mu-radius-rounded);
      background: color-mix(in srgb, var(--mu-color-marmot-soft) 75%, var(--mu-color-surface));
      --mu-coin-size: clamp(52px, 15vw, 72px);

      li {
        position: relative;
        display: inline-flex;
      }
    }

    .counting li {
      animation: mu-count-pop 0.5s var(--mu-ease-bounce) both;
      animation-delay: calc(var(--i) * 0.7s);
    }

    .amount {
      display: flex;
      align-items: center;
      gap: var(--mu-space-2);
      margin: 0;
      font: 800 clamp(2rem, 1.6rem + 2vw, 2.75rem) / 1 var(--mu-font-learn);
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
      width: min(100%, 520px);
      min-height: 104px;
      border: 3px dashed var(--mu-color-border-strong);
      --mu-coin-size: clamp(48px, 13vw, 60px);
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

    .scene {
      flex-wrap: nowrap;
      gap: var(--mu-space-2);
    }

    .purse--side {
      flex: 1 1 0;
      min-width: 0;
      min-height: 120px;
      --mu-coin-size: clamp(40px, 11vw, 60px);
    }

    .slot {
      flex: none;
      min-width: 56px;
      padding: 0;
      font-size: 2.5rem;
    }

    .signs {
      display: flex;
      justify-content: center;
      gap: var(--mu-space-4);

      .mu-choice {
        min-width: 88px;
        font-size: 3rem;
      }
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
      .counting li,
      .placing li {
        animation: none;
      }
    }
  `,
})
export class Money extends ExerciseBase<'money-chf'> {
  private readonly transloco = inject(TranslocoService);

  protected readonly relations: readonly Relation[] = ['lt', 'eq', 'gt'];
  protected readonly signs = SIGNS;
  protected readonly maxTray = MAX_TRAY;
  protected readonly coinStep = COIN_STEP_MS;
  protected readonly typed = signal('');
  protected readonly picked = signal<Relation | null>(null);
  protected readonly placed = signal<readonly Placed[]>([]);
  protected readonly status = signal('');
  private nextKey = 0;

  protected readonly unit = computed(() =>
    unitParts(this.payload().currency, this.payload().group),
  );
  protected readonly items = computed(() => {
    const payload = this.payload();
    return payload.mode === 'total' ? payload.items : [];
  });
  protected readonly totalMode = computed(() => {
    const payload = this.payload();
    return payload.mode === 'total' ? payload.answerMode : 'keypad';
  });
  protected readonly totalChoices = computed(() => {
    const payload = this.payload();
    return payload.mode === 'total' ? payload.choices : undefined;
  });
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

  protected readonly revealValue = computed(() => {
    const reveal = this.reveal();
    return reveal && 'value' in reveal ? reveal.value : null;
  });
  protected readonly revealedRelation = computed(() => {
    const reveal = this.reveal();
    return reveal && 'relation' in reveal ? reveal.relation : null;
  });
  protected readonly revealedCoins = computed(() => {
    const reveal = this.reveal();
    return reveal && 'coins' in reveal ? reveal.coins : null;
  });
  protected readonly shown = computed(() => {
    const value = this.revealValue();
    return value !== null ? String(value) : this.typed();
  });
  protected readonly shownMoney = computed(() =>
    formatMoney(this.shown(), this.payload().currency, this.payload().group),
  );
  protected readonly relation = computed(() => this.revealedRelation() ?? this.picked());
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

  protected readonly sides = computed(() => {
    const payload = this.payload();
    if (payload.mode !== 'compare') {
      return [];
    }
    return [
      {
        key: 'left',
        items: payload.left,
        label: this.describe('learn.ex.compareLeft', payload.left),
      },
      {
        key: 'right',
        items: payload.right,
        label: this.describe('learn.ex.compareRight', payload.right),
      },
    ];
  });

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

  protected choose(relation: Relation): void {
    if (this.locked()) {
      return;
    }
    this.picked.set(relation);
    this.emit({ relation });
  }

  private announce(): void {
    const labels = this.placed().map((entry) => entry.item.label);
    this.status.set(
      labels.length === 0
        ? this.transloco.translate('learn.ex.money.trayEmpty')
        : `${this.transloco.translate('learn.ex.money.tray')}: ${labels.join(', ')}`,
    );
  }

  private describe(key: string, items: readonly MoneyItem[]): string {
    return `${this.transloco.translate(key)}: ${items.map((item) => item.label).join(', ')}`;
  }
}
