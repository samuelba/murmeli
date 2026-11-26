import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChoiceItem, Choices } from '../shared/choices';
import { ExerciseBase } from '../shared/exercise-base';
import { HearBadge } from '../shared/hear-badge';

/** Hears a sound ("M wie Maus") and taps the letter. */
@Component({
  selector: 'mu-letter-sound',
  imports: [TranslocoPipe, Choices, HearBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <mu-hear-badge [class.mu-cue]="highlighted('prompt')" />
      <mu-choices
        kind="letter"
        [choices]="payload().choices"
        [label]="'learn.ex.answers' | transloco"
        [locked]="locked()"
        [revealId]="reveal()?.choiceId ?? null"
        [pointing]="pointing()"
        [highlighted]="highlighted('letters', 'choices')"
        (picked)="pick($event)"
      />
    </div>
  `,
})
export class LetterSound extends ExerciseBase<'letter-sound'> {
  protected pick(choice: ChoiceItem): void {
    this.emit({ choiceId: choice.id });
  }
}
