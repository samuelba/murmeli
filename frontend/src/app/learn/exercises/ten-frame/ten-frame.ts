import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExerciseBase } from '../shared/exercise-base';
import { FrameCell, FrameGrid } from '../shared/frame-grid';
import { ValueAnswer } from '../shared/value-answer';

/** Reads how many counters a Zehnerfeld or Zwanzigerfeld holds. */
@Component({
  selector: 'mu-ten-frame',
  imports: [TranslocoPipe, FrameGrid, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div
        class="mu-ex__stage"
        role="img"
        data-testid="ten-frame"
        [attr.aria-label]="
          'learn.ex.frame' | transloco: { filled: filled(), total: payload().frame }
        "
        [class.mu-cue]="highlighted('frame', 'objects')"
      >
        <mu-frame-grid [cells]="cells()" [counting]="countingAlong()" />
      </div>
      <mu-value-answer
        [mode]="payload().answerMode"
        [choices]="payload().choices"
        [locked]="locked()"
        [revealValue]="reveal()?.value ?? null"
        [pointing]="pointing()"
        [highlighted]="highlighted('choices', 'numbers')"
        [maxDigits]="2"
        (answered)="emit({ value: $event })"
      />
    </div>
  `,
})
export class TenFrame extends ExerciseBase<'ten-frame'> {
  protected readonly cells = computed<FrameCell[]>(() =>
    this.payload().cells.map((filled) => (filled ? 'filled' : 'empty')),
  );
  protected readonly filled = computed(() => this.payload().cells.filter(Boolean).length);
}
