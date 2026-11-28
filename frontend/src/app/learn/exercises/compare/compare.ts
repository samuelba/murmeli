import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { CompareSide } from '@murmeli/content';
import { LearnContent } from '../../content/learn-content';
import { ExerciseBase } from '../shared/exercise-base';
import { Icon } from '../../../shared/icon/icon';
import { Pointer } from '../shared/pointer';
import { Quantity } from '../shared/quantity';
import { type Relation, RelationSign } from '../shared/relation-sign';

/**
 * Two amounts: the kid taps the side with more, or "the same". Two numbers: the kid taps <, = or >,
 * drawn as the crocodile. Both answer with the relation of left to right.
 */
@Component({
  selector: 'mu-compare',
  imports: [TranslocoPipe, Icon, Pointer, Quantity, RelationSign],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mu-ex"
      [attr.role]="byAmount() ? 'group' : null"
      [attr.aria-label]="byAmount() ? ('learn.ex.answers' | transloco) : null"
    >
      @if (byAmount()) {
        <div
          class="mu-ex__stage scene by-amount"
          [class.mu-cue]="highlighted('numbers', 'objects', 'choices')"
        >
          @for (side of sides(); track side.key) {
            <button
              type="button"
              class="side mu-choice"
              [class.mu-choice--selected]="picked() === side.relation"
              [class.mu-choice--revealed]="revealed() === side.relation"
              [attr.aria-pressed]="picked() === side.relation"
              [attr.aria-disabled]="locked() ? 'true' : null"
              [attr.aria-label]="side.label"
              [attr.data-testid]="'compare-' + side.key"
              (click)="choose(side.relation)"
            >
              <mu-quantity
                [kind]="side.pictureId ? 'objects' : 'dots'"
                [count]="side.count ?? 0"
                [perRow]="3"
                [pictureId]="side.pictureId ?? null"
                [counting]="countingAlong()"
              />
              @if (revealed() === side.relation) {
                <span class="mu-choice__badge"><mu-icon name="check" /></span>
                @if (pointing()) {
                  <mu-pointer />
                }
              }
            </button>
          }
        </div>
        <div class="signs" [class.mu-cue]="highlighted('signs', 'choices')">
          <button
            type="button"
            class="mu-choice same"
            [class.mu-choice--selected]="picked() === 'eq'"
            [class.mu-choice--revealed]="revealed() === 'eq'"
            [attr.aria-pressed]="picked() === 'eq'"
            [attr.aria-disabled]="locked() ? 'true' : null"
            data-testid="relation-eq"
            (click)="choose('eq')"
          >
            <svg class="same__picture" viewBox="0 0 40 32" aria-hidden="true" focusable="false">
              @for (y of [6, 16, 26]; track y) {
                <circle cx="10" [attr.cy]="y" r="4.5" />
                <circle cx="30" [attr.cy]="y" r="4.5" />
              }
            </svg>
            <span class="same__label">{{ 'learn.ex.compareSame' | transloco }}</span>
            @if (revealed() === 'eq') {
              <span class="mu-choice__badge"><mu-icon name="check" /></span>
              @if (pointing()) {
                <mu-pointer />
              }
            }
          </button>
        </div>
      } @else {
        <div class="mu-ex__stage scene" [class.mu-cue]="highlighted('numbers', 'objects')">
          @for (side of sides(); track side.key) {
            <div
              class="side"
              role="img"
              [attr.aria-label]="side.label"
              [attr.data-testid]="'compare-' + side.key"
            >
              <span class="mu-number">{{ side.value }}</span>
            </div>
            @if ($first) {
              <span
                class="slot mu-blank"
                data-testid="compare-slot"
                [class.mu-blank--filled]="shown() !== null"
                [class.mu-blank--revealed]="revealed() !== null"
                aria-hidden="true"
              >
                @if (shown(); as relation) {
                  <mu-relation-sign [relation]="relation" />
                } @else {
                  ?
                }
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
          @for (relation of relations; track relation) {
            <button
              type="button"
              class="mu-choice"
              [class.mu-choice--selected]="picked() === relation"
              [class.mu-choice--revealed]="revealed() === relation"
              [attr.aria-pressed]="picked() === relation"
              [attr.aria-disabled]="locked() ? 'true' : null"
              [attr.aria-label]="'learn.ex.relation.' + relation | transloco"
              [attr.data-testid]="'relation-' + relation"
              (click)="choose(relation)"
            >
              <mu-relation-sign [relation]="relation" />
              @if (revealed() === relation) {
                <span class="mu-choice__badge"><mu-icon name="check" /></span>
                @if (pointing()) {
                  <mu-pointer />
                }
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .scene {
      flex-wrap: nowrap;
      gap: var(--mu-space-2);
    }

    .scene.by-amount {
      gap: var(--mu-space-3);
    }

    .side {
      display: grid;
      flex: 1 1 0;
      min-width: 0;
      min-height: 120px;
      place-items: center;
      padding: var(--mu-space-2);
      border-radius: var(--mu-radius-rounded);
      background: color-mix(in srgb, var(--mu-color-sky) 14%, var(--mu-color-surface));
      container-type: inline-size;
      --mu-object-size: min(44px, calc((100cqw - 28px) / 3));
      --mu-dot-size: min(30px, calc((100cqw - 28px) / 3));
    }

    button.side {
      --mu-choice-tint: color-mix(in srgb, var(--mu-color-sky) 14%, #fffdf8);
      background: var(--mu-choice-tint);
      border-radius: var(--mu-radius-chunky);
    }

    .slot {
      flex: none;
      min-width: 72px;
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

    .signs .same {
      flex-direction: column;
      gap: var(--mu-space-1);
      min-width: 112px;
      font-size: var(--mu-font-size-lg);
    }

    .same__picture {
      width: 48px;
      height: 38px;
      fill: currentColor;
    }
  `,
})
export class Compare extends ExerciseBase<'compare'> {
  private readonly transloco = inject(TranslocoService);
  private readonly content = inject(LearnContent);

  protected readonly relations: readonly Relation[] = ['lt', 'eq', 'gt'];
  protected readonly picked = signal<Relation | null>(null);
  protected readonly revealed = computed(() => this.reveal()?.relation ?? null);
  protected readonly shown = computed(() => this.revealed() ?? this.picked());
  protected readonly byAmount = computed(() => this.payload().mode === 'quantities');

  protected readonly sides = computed(() => {
    const { left, right } = this.payload();
    return [
      {
        key: 'left',
        relation: 'gt' as const,
        ...left,
        label: this.describe('learn.ex.compareLeft', left),
      },
      {
        key: 'right',
        relation: 'lt' as const,
        ...right,
        label: this.describe('learn.ex.compareRight', right),
      },
    ];
  });

  private describe(key: string, side: CompareSide): string {
    const position = this.transloco.translate(key);
    if (side.value !== undefined) {
      return `${position}: ${side.value}`;
    }
    const count = side.count ?? 0;
    const amount = side.pictureId
      ? this.transloco.translate('learn.ex.quantity.objects', {
          count,
          word: this.content.word(side.pictureId),
        })
      : this.transloco.translate('learn.ex.quantity.dots', { count });
    return `${position}: ${amount}`;
  }

  protected choose(relation: Relation): void {
    if (this.locked()) {
      return;
    }
    this.picked.set(relation);
    this.emit({ relation });
  }
}
