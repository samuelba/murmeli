import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LearnContent } from '../../content/learn-content';
import { ChoiceItem, Choices } from '../shared/choices';
import { ExerciseBase } from '../shared/exercise-base';
import { HearBadge } from '../shared/hear-badge';
import { Quantity, QuantityKind } from '../shared/quantity';

const KINDS: Record<string, QuantityKind> = {
  dots: 'dots',
  'ten-frame': 'frame',
  fingers: 'fingers',
  objects: 'objects',
};

/** Hear a number and tap the numeral, or find the picture that shows the amount. */
@Component({
  selector: 'mu-number-recognition',
  imports: [TranslocoPipe, Choices, HearBadge, Quantity],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      @if (payload().mode === 'hear') {
        <mu-hear-badge [class.mu-cue]="highlighted('prompt', 'numbers')" />
        <mu-choices
          [choices]="payload().choices"
          [label]="'learn.ex.answers' | transloco"
          [locked]="locked()"
          [revealId]="revealId()"
          [pointing]="pointing()"
          [highlighted]="highlighted('choices')"
          (picked)="pick($event)"
        />
      } @else {
        <mu-choices
          kind="custom"
          [choices]="payload().choices"
          [label]="'learn.ex.answers' | transloco"
          [locked]="locked()"
          [revealId]="revealId()"
          [pointing]="pointing()"
          [highlighted]="highlighted('choices', 'objects', 'frame')"
          [template]="quantity"
          [labelFor]="labelFor"
          (picked)="pick($event)"
        />
        <ng-template #quantity let-choice>
          <mu-quantity
            [kind]="kind()"
            [count]="choice.value ?? 0"
            [pictureId]="payload().pictureId ?? null"
            [counting]="countingAlong()"
          />
        </ng-template>
      }
    </div>
  `,
})
export class NumberRecognition extends ExerciseBase<'number-recognition'> {
  private readonly transloco = inject(TranslocoService);
  private readonly content = inject(LearnContent);

  protected readonly kind = computed(() => KINDS[this.payload().representation] ?? 'dots');
  protected readonly revealId = computed(() => {
    const value = this.reveal()?.value;
    return this.payload().choices.find((choice) => choice.value === value)?.id ?? null;
  });

  protected readonly labelFor = (choice: ChoiceItem): string => {
    const count = choice.value ?? 0;
    const kind = this.kind();
    const pictureId = this.payload().pictureId;
    return kind === 'objects' && pictureId
      ? this.transloco.translate('learn.ex.quantity.objects', {
          count,
          word: this.content.word(pictureId),
        })
      : this.transloco.translate(`learn.ex.quantity.${kind}`, { count });
  };

  protected pick(choice: ChoiceItem): void {
    if (choice.value !== undefined) {
      this.emit({ value: choice.value });
    }
  }
}
