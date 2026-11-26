import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Pointer } from './pointer';

export interface LetterTile {
  readonly id: string;
  readonly letter: string;
}

/**
 * Slots for a word and the letter tiles to fill them: tap a tile to place it, a slot to take it
 * out again, then "Prüfen". Shared by building a word (picture) and writing a heard word.
 */
@Component({
  selector: 'mu-letter-tiles',
  imports: [TranslocoPipe, Pointer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol
      class="slots"
      data-testid="slots"
      [attr.aria-label]="'learn.ex.build.slots' | transloco"
      [class.mu-cue]="highlightSlots()"
    >
      @for (slot of slots(); track $index) {
        <li>
          <button
            type="button"
            class="slot mu-blank"
            [class.mu-blank--filled]="slot !== null"
            [class.mu-blank--revealed]="revealed() !== null"
            [style.--i]="$index"
            [attr.aria-disabled]="locked() || slot === null ? 'true' : null"
            [attr.aria-label]="
              slot === null
                ? ('learn.ex.build.slotEmpty' | transloco: { number: $index + 1 })
                : ('learn.ex.build.slot' | transloco: { number: $index + 1, letter: slot })
            "
            [attr.data-testid]="'slot-' + $index"
            (click)="remove($index)"
          >
            {{ slot ?? '' }}
            @if (pointing() && revealed() !== null && $last) {
              <mu-pointer />
            }
          </button>
        </li>
      }
    </ol>
    <p class="mu-visually-hidden" aria-live="polite" data-testid="build-status">
      {{ 'learn.ex.build.slots' | transloco }}: {{ spoken() }}
    </p>
    <div
      class="tiles"
      role="group"
      [attr.aria-label]="'learn.ex.build.tiles' | transloco"
      [class.mu-cue]="highlightTiles()"
    >
      @for (tile of tiles(); track tile.id) {
        <button
          type="button"
          class="tile mu-learning-text"
          [class.tile--used]="isUsed(tile.id)"
          [attr.aria-disabled]="locked() || isUsed(tile.id) ? 'true' : null"
          [attr.aria-label]="'learn.ex.build.tile' | transloco: { letter: tile.letter }"
          [attr.data-testid]="'tile-' + tile.id"
          [attr.data-letter]="tile.letter"
          (click)="place(tile.id)"
        >
          {{ tile.letter }}
        </button>
      }
    </div>
    <button
      type="button"
      class="mu-button mu-button--primary mu-ex__check"
      data-testid="check"
      [attr.aria-disabled]="locked() || !full() ? 'true' : null"
      (click)="check()"
    >
      {{ 'learn.ex.check' | transloco }}
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }

    .slots,
    .tiles {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .slot {
      min-width: 68px;
      min-height: 76px;
      font-family: var(--mu-font-learn);
      border-color: var(--mu-color-marmot);

      &.mu-blank--revealed {
        animation-delay: calc(var(--i) * 0.5s);
      }
    }

    .tile {
      min-width: 68px;
      min-height: 72px;
      border: 3px solid var(--mu-color-signpost-black);
      border-radius: var(--mu-radius-md);
      background: var(--mu-color-sun);
      color: var(--mu-color-signpost-black);
      font-size: 2.25rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 5px 0 var(--mu-color-primary-edge);
      touch-action: manipulation;

      &:active:not([aria-disabled='true']) {
        transform: translateY(4px);
        box-shadow: 0 1px 0 var(--mu-color-primary-edge);
      }

      &--used {
        opacity: 0.25;
        box-shadow: none;
        cursor: default;
      }
    }
  `,
})
export class LetterTiles {
  readonly length = input.required<number>();
  readonly tiles = input.required<readonly LetterTile[]>();
  readonly locked = input(false, { transform: booleanAttribute });
  readonly revealed = input<readonly string[] | null>(null);
  readonly pointing = input(false, { transform: booleanAttribute });
  readonly highlightSlots = input(false, { transform: booleanAttribute });
  readonly highlightTiles = input(false, { transform: booleanAttribute });
  readonly answered = output<string[]>();

  private readonly placed = signal<readonly (string | null)[]>([]);

  private readonly placedTiles = computed(() =>
    Array.from({ length: this.length() }, (_, index) => this.placed()[index] ?? null),
  );
  protected readonly slots = computed(() => {
    const revealed = this.revealed();
    if (revealed) {
      return Array.from({ length: this.length() }, (_, index) => revealed[index] ?? null);
    }
    const letters = new Map(this.tiles().map((tile) => [tile.id, tile.letter]));
    return this.placedTiles().map((id) => (id === null ? null : (letters.get(id) ?? null)));
  });
  protected readonly spoken = computed(() =>
    this.slots()
      .map((letter) => letter ?? '_')
      .join(' '),
  );
  protected readonly full = computed(() => this.placedTiles().every((id) => id !== null));

  protected isUsed(id: string): boolean {
    return this.placedTiles().includes(id);
  }

  protected place(id: string): void {
    if (this.locked() || this.isUsed(id)) {
      return;
    }
    const slots = [...this.placedTiles()];
    const free = slots.indexOf(null);
    if (free >= 0) {
      slots[free] = id;
      this.placed.set(slots);
    }
  }

  protected remove(index: number): void {
    if (this.locked()) {
      return;
    }
    const slots = [...this.placedTiles()];
    slots[index] = null;
    this.placed.set(slots);
  }

  protected check(): void {
    const letters = this.slots();
    if (!this.locked() && this.full() && letters.every((letter) => letter !== null)) {
      this.answered.emit(letters as string[]);
    }
  }
}
