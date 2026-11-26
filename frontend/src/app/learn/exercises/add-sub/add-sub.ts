import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Pointer } from '../shared/pointer';
import { ExerciseBase } from '../shared/exercise-base';
import { FrameCell, FrameGrid } from '../shared/frame-grid';
import { Picture } from '../shared/picture';
import { ValueAnswer } from '../shared/value-answer';

interface Term {
  readonly key: string;
  readonly text: string | null;
  readonly blank: boolean;
}

/** a + b = ? or a − b = ? (or a + ? = c), with optional pictures or a ten-frame to help. */
@Component({
  selector: 'mu-add-sub',
  imports: [FrameGrid, Picture, Pointer, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage stage">
        @if (frameCells(); as cells) {
          <div aria-hidden="true" [class.mu-cue]="highlighted('frame', 'objects')">
            <mu-frame-grid [cells]="cells" [counting]="countingAlong()" />
          </div>
        } @else if (objects(); as groups) {
          <div
            class="objects"
            aria-hidden="true"
            [class.mu-cue]="highlighted('objects', 'picture')"
          >
            @for (group of groups; track $index) {
              @if (!$first) {
                <span class="plus">+</span>
              }
              <span class="group" [class.counting]="countingAlong()">
                @for (item of group; track item.index) {
                  <span class="object" [class.object--gone]="item.gone" [style.--i]="item.index">
                    <mu-picture decorative [id]="payload().pictureId!" />
                  </span>
                }
              </span>
            }
          </div>
        }
        <p
          class="equation mu-learning-text"
          data-testid="equation"
          [class.mu-cue]="highlighted('numbers', 'prompt')"
        >
          @for (term of terms(); track term.key) {
            @if (term.blank) {
              <span
                class="mu-blank"
                data-testid="answer-blank"
                [class.mu-blank--filled]="shown() !== ''"
                [class.mu-blank--revealed]="reveal() !== null"
              >
                {{ shown() || '?' }}
                @if (pointing() && reveal() !== null) {
                  <mu-pointer />
                }
              </span>
            } @else {
              <span class="term">{{ term.text }}</span>
            }
          }
        </p>
      </div>
      <mu-value-answer
        [mode]="payload().answerMode"
        [choices]="payload().choices"
        [locked]="locked()"
        [revealValue]="reveal()?.value ?? null"
        [pointing]="pointing() && payload().answerMode === 'choices'"
        [highlighted]="highlighted('choices')"
        [showBlank]="false"
        (typedChange)="typed.set($event)"
        (answered)="emit({ value: $event })"
      />
    </div>
  `,
  styles: `
    .stage {
      flex-direction: column;
    }

    .equation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-2) var(--mu-space-3);
      margin: 0;
      font-size: clamp(2.5rem, 1.8rem + 3vw, 3.5rem);
      font-weight: 700;
      line-height: 1;
    }

    .objects {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--mu-space-3);
    }

    .group {
      display: grid;
      grid-template-columns: repeat(5, auto);
      gap: 4px;
    }

    .plus {
      font: 800 2rem/1 var(--mu-font-learn);
    }

    .object {
      position: relative;
      display: inline-flex;

      mu-picture {
        width: clamp(32px, 9vw, 48px);
        height: clamp(32px, 9vw, 48px);
      }

      &--gone {
        opacity: 0.4;

        &::after {
          content: '';
          position: absolute;
          inset: 45% -4px auto;
          height: 5px;
          border-radius: 3px;
          background: var(--mu-color-text);
          transform: rotate(-35deg);
        }
      }
    }

    .counting .object {
      animation: mu-count-pop 0.5s var(--mu-ease-bounce) both;
      animation-delay: calc(var(--i) * 0.6s);
    }
  `,
})
export class AddSub extends ExerciseBase<'add-sub'> {
  protected readonly typed = signal('');
  protected readonly shown = computed(() => {
    const value = this.reveal()?.value;
    return value !== undefined ? String(value) : this.typed();
  });

  protected readonly terms = computed<Term[]>(() => {
    const { op, a, b, result } = this.payload();
    const value = (key: string, number: number | null): Term => ({
      key,
      text: number === null ? null : String(number),
      blank: number === null,
    });
    return [
      value('a', a),
      { key: 'op', text: op === 'add' ? '+' : '−', blank: false },
      value('b', b),
      { key: 'eq', text: '=', blank: false },
      value('result', result),
    ];
  });

  protected readonly frameCells = computed<FrameCell[] | null>(() => {
    const { manipulatives, a, b, op } = this.payload();
    if (manipulatives !== 'ten-frame' && manipulatives !== 'twenty-frame') {
      return null;
    }
    const size = manipulatives === 'ten-frame' ? 10 : 20;
    const second = b ?? 0;
    return Array.from({ length: size }, (_, index): FrameCell => {
      if (op === 'add') {
        return index < a ? 'filled' : index < a + second ? 'added' : 'empty';
      }
      return index < a - second ? 'filled' : index < a ? 'removed' : 'empty';
    });
  });

  protected readonly objects = computed(() => {
    const { manipulatives, a, b, op, pictureId } = this.payload();
    if (manipulatives !== 'objects' || !pictureId) {
      return null;
    }
    const second = b ?? 0;
    const items = (count: number, offset: number, gone: (i: number) => boolean = () => false) =>
      Array.from({ length: count }, (_, i) => ({ index: offset + i, gone: gone(i) }));
    return op === 'add'
      ? [items(a, 0), ...(second > 0 ? [items(second, a)] : [])]
      : [items(a, 0, (i) => i >= a - second)];
  });
}
