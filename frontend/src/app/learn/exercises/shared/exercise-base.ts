import { Directive, computed, input, output } from '@angular/core';
import type { Answer, DemoAction, ExerciseTypeId, HintKey, Payload } from '../../learn.models';

export type HighlightTarget = NonNullable<DemoAction['highlight']>;

/**
 * Inputs and output every exercise component shares. `locked` blocks input (checking, feedback,
 * demo), `reveal` shows an answer (the solution after two tries, or Murmeli's demo answer) and
 * `cue` is the current demo action (highlight, count along, hop ...). `hint` is the hint of the
 * last wrong answer, for exercises that show it on their own (tracing replays the model).
 */
@Directive()
export abstract class ExerciseBase<T extends ExerciseTypeId> {
  readonly payload = input.required<Payload<T>>();
  readonly locked = input(false);
  readonly reveal = input<Answer<T> | null>(null);
  readonly cue = input<DemoAction | null>(null);
  readonly hint = input<HintKey | null>(null);
  readonly answered = output<Answer<T>>();

  /** A demo is running: the answer is being shown by Murmeli, not given by the kid. */
  protected readonly demo = computed(() => this.cue() !== null);
  protected readonly pointing = computed(() => this.cue()?.tapAnswer === true);
  protected readonly countingAlong = computed(() => this.cue()?.countAlong === true);

  protected highlighted(...targets: HighlightTarget[]): boolean {
    const target = this.cue()?.highlight;
    return target !== undefined && targets.includes(target);
  }

  protected emit(answer: Answer<T>): void {
    if (!this.locked()) {
      this.answered.emit(answer);
    }
  }
}
