import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { MoneyItem } from '@murmeli/content';
import { Icon } from '../../../shared/icon/icon';
import { ExerciseBase } from '../shared/exercise-base';
import { Pointer } from '../shared/pointer';
import { type Relation, RelationSign } from '../shared/relation-sign';
import { MoneyPiece } from './money-piece';

/** "Wo ist mehr Geld?": two purses and <, = or >. */
@Component({
  selector: 'mu-money-compare',
  imports: [TranslocoPipe, Icon, MoneyPiece, Pointer, RelationSign],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex__stage scene" [class.mu-cue]="highlighted('money', 'objects')">
      @for (side of sides(); track side.key) {
        <ul
          class="mu-purse side"
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
            @if (relation(); as shown) {
              <mu-relation-sign [relation]="shown" />
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
      @for (option of relations; track option) {
        <button
          type="button"
          class="mu-choice"
          [class.mu-choice--selected]="picked() === option"
          [class.mu-choice--revealed]="revealed() === option"
          [attr.aria-disabled]="locked() ? 'true' : null"
          [attr.aria-label]="'learn.ex.relation.' + option | transloco"
          [attr.data-testid]="'relation-' + option"
          (click)="choose(option)"
        >
          <mu-relation-sign [relation]="option" />
          @if (revealed() === option) {
            <span class="mu-choice__badge"><mu-icon name="check" /></span>
            @if (pointing()) {
              <mu-pointer />
            }
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }

    .scene {
      flex-wrap: nowrap;
      gap: var(--mu-space-2);
    }

    .side {
      flex: 1 1 0;
      min-width: 0;
      min-height: 120px;
      --mu-coin-size: clamp(40px, 11vw, 60px);
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
  `,
})
export class MoneyCompare extends ExerciseBase<'money-chf'> {
  private readonly transloco = inject(TranslocoService);

  protected readonly relations: readonly Relation[] = ['lt', 'eq', 'gt'];
  protected readonly picked = signal<Relation | null>(null);
  protected readonly revealed = computed(() => {
    const reveal = this.reveal();
    return reveal && 'relation' in reveal ? reveal.relation : null;
  });
  protected readonly relation = computed(() => this.revealed() ?? this.picked());
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

  protected choose(relation: Relation): void {
    if (this.locked()) {
      return;
    }
    this.picked.set(relation);
    this.emit({ relation });
  }

  private describe(key: string, items: readonly MoneyItem[]): string {
    return `${this.transloco.translate(key)}: ${items.map((item) => item.label).join(', ')}`;
  }
}
