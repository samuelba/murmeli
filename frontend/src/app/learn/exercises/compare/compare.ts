import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { CompareSide } from '@murmeli/content';
import { LearnContent } from '../../content/learn-content';
import { ExerciseBase } from '../shared/exercise-base';
import { Icon } from '../../../shared/icon/icon';
import { Pointer } from '../shared/pointer';
import { Quantity } from '../shared/quantity';

type Relation = 'lt' | 'eq' | 'gt';

const SIGNS: Readonly<Record<Relation, string>> = { lt: '<', eq: '=', gt: '>' };

/** Two numbers or groups, and the kid taps <, = or >. */
@Component({
  selector: 'mu-compare',
  imports: [TranslocoPipe, Icon, Pointer, Quantity],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage scene" [class.mu-cue]="highlighted('numbers', 'objects')">
        @for (side of sides(); track side.key) {
          <div
            class="side"
            role="img"
            [attr.aria-label]="side.label"
            [attr.data-testid]="'compare-' + side.key"
          >
            @if (side.value !== undefined) {
              <span class="mu-number">{{ side.value }}</span>
            } @else {
              <mu-quantity
                [kind]="side.pictureId ? 'objects' : 'dots'"
                [count]="side.count ?? 0"
                [perRow]="3"
                [pictureId]="side.pictureId ?? null"
                [counting]="countingAlong()"
              />
            }
          </div>
          @if ($first) {
            <span
              class="slot mu-blank"
              data-testid="compare-slot"
              [class.mu-blank--filled]="shown() !== null"
              [class.mu-blank--revealed]="reveal() !== null"
              aria-hidden="true"
            >
              {{ shown() ? signs[shown()!] : '?' }}
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
            [class.mu-choice--revealed]="reveal()?.relation === relation"
            [attr.aria-disabled]="locked() ? 'true' : null"
            [attr.aria-label]="'learn.ex.relation.' + relation | transloco"
            [attr.data-testid]="'relation-' + relation"
            (click)="choose(relation)"
          >
            <span aria-hidden="true">{{ signs[relation] }}</span>
            @if (reveal()?.relation === relation) {
              <span class="mu-choice__badge"><mu-icon name="check" /></span>
              @if (pointing()) {
                <mu-pointer />
              }
            }
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .scene {
      flex-wrap: nowrap;
      gap: var(--mu-space-2);
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
  `,
})
export class Compare extends ExerciseBase<'compare'> {
  private readonly transloco = inject(TranslocoService);
  private readonly content = inject(LearnContent);

  protected readonly relations: readonly Relation[] = ['lt', 'eq', 'gt'];
  protected readonly signs = SIGNS;
  protected readonly picked = signal<Relation | null>(null);
  protected readonly shown = computed(() => this.reveal()?.relation ?? this.picked());

  protected readonly sides = computed(() => {
    const { left, right } = this.payload();
    return [
      { key: 'left', ...left, label: this.describe('learn.ex.compareLeft', left) },
      { key: 'right', ...right, label: this.describe('learn.ex.compareRight', right) },
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
