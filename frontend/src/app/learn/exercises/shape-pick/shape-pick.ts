import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChoiceItem, Choices } from '../shared/choices';
import { ExerciseBase } from '../shared/exercise-base';
import { Picture } from '../shared/picture';

/** Taps the named shape among shapes of different size and rotation. */
@Component({
  selector: 'mu-shape-pick',
  imports: [TranslocoPipe, Choices, Picture],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <mu-choices
        kind="custom"
        [choices]="payload().choices"
        [label]="'learn.ex.answers' | transloco"
        [locked]="locked()"
        [revealId]="reveal()?.choiceId ?? null"
        [pointing]="pointing()"
        [highlighted]="highlighted('shapes', 'choices')"
        [template]="shape"
        (picked)="pick($event)"
      />
      <ng-template #shape let-choice>
        <mu-picture
          class="shape"
          [id]="choice.pictureId"
          [style.transform]="transformOf(choice.id)"
        />
      </ng-template>
    </div>
  `,
  styles: `
    .shape {
      width: clamp(64px, 20vw, 100px);
      height: clamp(64px, 20vw, 100px);
    }
  `,
})
export class ShapePick extends ExerciseBase<'shape-pick'> {
  private readonly transforms = computed(
    () =>
      new Map(
        this.payload().choices.map((choice) => [
          choice.id,
          `rotate(${choice.rotation}deg) scale(${choice.scale})`,
        ]),
      ),
  );

  protected transformOf(id: string): string {
    return this.transforms().get(id) ?? 'none';
  }

  protected pick(choice: ChoiceItem): void {
    this.emit({ choiceId: choice.id });
  }
}
