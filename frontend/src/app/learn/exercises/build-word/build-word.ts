import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExerciseBase } from '../shared/exercise-base';
import { Picture } from '../shared/picture';
import { Pointer } from '../shared/pointer';

/** Builds the word for a picture from letter tiles: tap a tile to place it, a slot to remove it. */
@Component({
  selector: 'mu-build-word',
  imports: [TranslocoPipe, Picture, Pointer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage" [class.mu-cue]="highlighted('picture', 'word')">
        <mu-picture class="hero" data-testid="exercise-picture" [id]="payload().pictureId" />
      </div>
      <ol class="slots" data-testid="slots" [attr.aria-label]="'learn.ex.build.slots' | transloco">
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
        [class.mu-cue]="highlighted('tiles', 'letters')"
      >
        @for (tile of payload().tiles; track tile.id) {
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
    </div>
  `,
  styles: `
    .hero {
      width: clamp(110px, 34vw, 160px);
      height: clamp(110px, 34vw, 160px);
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
export class BuildWord extends ExerciseBase<'build-word'> {
  private readonly placed = signal<readonly (string | null)[]>([]);

  protected readonly revealed = computed(() => this.reveal()?.letters ?? null);
  private readonly placedTiles = computed(() =>
    Array.from({ length: this.payload().length }, (_, index) => this.placed()[index] ?? null),
  );
  protected readonly slots = computed(() => {
    const revealed = this.revealed();
    if (revealed) {
      return Array.from({ length: this.payload().length }, (_, index) => revealed[index] ?? null);
    }
    const letters = new Map(this.payload().tiles.map((tile) => [tile.id, tile.letter]));
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
    if (this.full() && letters.every((letter) => letter !== null)) {
      this.emit({ letters: letters as string[] });
    }
  }
}
