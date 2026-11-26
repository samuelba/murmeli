import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChoiceItem, Choices } from '../shared/choices';
import { ExerciseBase } from '../shared/exercise-base';
import { Picture } from '../shared/picture';

/** Anlaut: sees a picture, hears its word and taps the first letter. */
@Component({
  selector: 'mu-initial-sound',
  imports: [TranslocoPipe, Choices, Picture],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage" [class.mu-cue]="highlighted('picture', 'word')">
        <mu-picture class="hero" data-testid="exercise-picture" [id]="payload().pictureId" />
      </div>
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
  styles: `
    .hero {
      width: clamp(120px, 38vw, 180px);
      height: clamp(120px, 38vw, 180px);
    }
  `,
})
export class InitialSound extends ExerciseBase<'initial-sound'> {
  protected pick(choice: ChoiceItem): void {
    this.emit({ choiceId: choice.id });
  }
}
