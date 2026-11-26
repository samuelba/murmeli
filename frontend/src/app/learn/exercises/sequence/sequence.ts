import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Choice } from '@murmeli/content';
import { ChoiceItem, Choices } from '../shared/choices';
import { ExerciseBase } from '../shared/exercise-base';
import { Picture } from '../shared/picture';
import { Pointer } from '../shared/pointer';
import { ValueAnswer } from '../shared/value-answer';

/** What comes next (or before, or in the gap): a number row or a picture pattern. */
@Component({
  selector: 'mu-sequence',
  imports: [TranslocoPipe, Choices, Picture, Pointer, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      @if (numbers(); as row) {
        <ol
          class="mu-ex__stage row"
          data-testid="sequence"
          [attr.aria-label]="'learn.ex.sequence' | transloco"
          [class.mu-cue]="highlighted('numbers', 'pattern')"
        >
          @for (item of row; track $index) {
            @if (item === null) {
              <li
                class="card mu-blank"
                data-testid="answer-blank"
                [class.mu-blank--filled]="shownValue() !== ''"
                [class.mu-blank--revealed]="revealedValue() !== null"
              >
                {{ shownValue() || '?' }}
                @if (pointing() && revealedValue() !== null) {
                  <mu-pointer />
                }
              </li>
            } @else {
              <li class="card">{{ item }}</li>
            }
          }
        </ol>
        <mu-value-answer
          [mode]="answerMode()"
          [choices]="numberChoices()"
          [locked]="locked()"
          [revealValue]="revealedValue()"
          [pointing]="pointing() && answerMode() === 'choices'"
          [highlighted]="highlighted('choices')"
          [showBlank]="false"
          (typedChange)="typed.set($event)"
          (answered)="emit({ value: $event })"
        />
      } @else {
        <ol
          class="mu-ex__stage row"
          data-testid="pattern"
          [attr.aria-label]="'learn.ex.pattern' | transloco"
          [class.mu-cue]="highlighted('pattern', 'picture')"
        >
          @for (item of pattern(); track $index) {
            <li class="card card--picture"><mu-picture [id]="item.pictureId" /></li>
          }
          <li
            class="card card--picture mu-blank"
            [class.mu-blank--revealed]="revealedPicture() !== null"
          >
            @if (revealedPicture(); as pictureId) {
              <mu-picture [id]="pictureId" />
            } @else {
              ?
            }
          </li>
        </ol>
        <mu-choices
          kind="picture"
          [choices]="patternChoices()"
          [label]="'learn.ex.answers' | transloco"
          [locked]="locked()"
          [revealId]="revealedChoice()"
          [pointing]="pointing()"
          [highlighted]="highlighted('choices')"
          (picked)="pick($event)"
        />
      }
    </div>
  `,
  styles: `
    .row {
      flex-wrap: wrap;
      gap: var(--mu-space-2);
      margin: 0;
      list-style: none;
    }

    .card {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
      min-height: 72px;
      padding: 0 var(--mu-space-2);
      border-radius: var(--mu-radius-rounded);
      background: color-mix(in srgb, var(--mu-color-sun) 30%, var(--mu-color-surface));
      font: 800 2rem/1 var(--mu-font-learn);

      &--picture {
        width: clamp(56px, 16vw, 80px);
        height: clamp(56px, 16vw, 80px);
        min-width: 0;
        min-height: 0;
        background: var(--mu-color-surface);

        mu-picture {
          width: 80%;
          height: 80%;
        }
      }
    }
  `,
})
export class Sequence extends ExerciseBase<'sequence'> {
  protected readonly typed = signal('');

  protected readonly numbers = computed(() => {
    const payload = this.payload();
    return payload.kind === 'numbers' ? payload.items : null;
  });
  protected readonly pattern = computed(() => {
    const payload = this.payload();
    return payload.kind === 'pattern' ? payload.items : [];
  });
  protected readonly answerMode = computed(() => {
    const payload = this.payload();
    return payload.kind === 'numbers' ? payload.answerMode : 'choices';
  });
  protected readonly numberChoices = computed<readonly Choice[] | undefined>(() => {
    const payload = this.payload();
    return payload.kind === 'numbers' ? payload.choices : undefined;
  });
  protected readonly patternChoices = computed<readonly Choice[]>(() => {
    const payload = this.payload();
    return payload.kind === 'pattern' ? payload.choices : [];
  });

  protected readonly revealedValue = computed(() => {
    const reveal = this.reveal();
    return reveal && 'value' in reveal ? reveal.value : null;
  });
  protected readonly revealedChoice = computed(() => {
    const reveal = this.reveal();
    return reveal && 'choiceId' in reveal ? reveal.choiceId : null;
  });
  protected readonly revealedPicture = computed(() => {
    const id = this.revealedChoice();
    return this.patternChoices().find((choice) => choice.id === id)?.pictureId ?? null;
  });
  protected readonly shownValue = computed(() => {
    const value = this.revealedValue();
    return value !== null ? String(value) : this.typed();
  });

  protected pick(choice: ChoiceItem): void {
    this.emit({ choiceId: choice.id });
  }
}
