import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChoiceItem, Choices } from '../shared/choices';
import { ExerciseBase } from '../shared/exercise-base';

/** Reads a word (optionally split into syllable arcs) and taps the matching picture. */
@Component({
  selector: 'mu-word-picture',
  imports: [TranslocoPipe, Choices],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage" [class.mu-cue]="highlighted('word', 'letters')">
        @if (syllables(); as parts) {
          <p class="word mu-learning-text" data-testid="word">
            <span class="mu-visually-hidden">{{ payload().word }}</span>
            @for (part of parts; track $index) {
              <span class="syllable" aria-hidden="true" [class.syllable--alt]="$odd">{{
                part
              }}</span>
            }
          </p>
        } @else {
          <p class="word mu-learning-text" data-testid="word">{{ payload().word }}</p>
        }
      </div>
      <mu-choices
        kind="picture"
        [choices]="payload().choices"
        [label]="'learn.ex.answers' | transloco"
        [locked]="locked()"
        [revealId]="reveal()?.choiceId ?? null"
        [pointing]="pointing()"
        [highlighted]="highlighted('choices', 'picture')"
        (picked)="pick($event)"
      />
    </div>
  `,
  styles: `
    .word {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      margin: 0;
      font-size: clamp(2.75rem, 2rem + 4vw, 4rem);
      font-weight: 700;
      line-height: 1.1;
      overflow-wrap: anywhere;
    }

    .syllable {
      padding: 0 6px 14px;
      border-bottom: 5px solid var(--mu-color-sky-strong);
      border-radius: 0 0 50% 50% / 0 0 100% 100%;
      color: var(--mu-color-sky-strong);

      &--alt {
        border-color: #d9534f;
        color: var(--mu-color-error-text);
      }
    }
  `,
})
export class WordPicture extends ExerciseBase<'word-picture'> {
  protected readonly syllables = computed(() => this.payload().syllables ?? null);

  protected pick(choice: ChoiceItem): void {
    this.emit({ choiceId: choice.id });
  }
}
