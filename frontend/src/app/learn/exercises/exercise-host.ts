import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { AnyAnswer, DemoAction, PublicExercise } from '../learn.models';
import { AddSub } from './add-sub/add-sub';
import { BuildWord } from './build-word/build-word';
import { Compare } from './compare/compare';
import { CountObjects } from './count-objects/count-objects';
import { InitialSound } from './initial-sound/initial-sound';
import { LetterSound } from './letter-sound/letter-sound';
import { NumberBond } from './number-bond/number-bond';
import { NumberLine } from './number-line/number-line';
import { NumberRecognition } from './number-recognition/number-recognition';
import { NumberWall } from './number-wall/number-wall';
import { Sequence } from './sequence/sequence';
import { ShapePick } from './shape-pick/shape-pick';
import { Syllables } from './syllables/syllables';
import { TenFrame } from './ten-frame/ten-frame';
import { WordPicture } from './word-picture/word-picture';

/** Exercise shapes the host can show: an item of a run, or the demo instance. */
export type ExerciseView = Pick<PublicExercise, 'type' | 'payload'>;

/** Renders the component for an exercise type. Payload and answer types follow `type`. */
@Component({
  selector: 'mu-exercise',
  imports: [
    AddSub,
    BuildWord,
    Compare,
    CountObjects,
    InitialSound,
    LetterSound,
    NumberBond,
    NumberLine,
    NumberRecognition,
    NumberWall,
    Sequence,
    ShapePick,
    Syllables,
    TenFrame,
    WordPicture,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-type]': 'exercise().type', class: 'mu-exercise' },
  template: `
    @switch (exercise().type) {
      @case ('count-objects') {
        <mu-count-objects
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('number-recognition') {
        <mu-number-recognition
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('ten-frame') {
        <mu-ten-frame
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('compare') {
        <mu-compare
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('number-line') {
        <mu-number-line
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('add-sub') {
        <mu-add-sub
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('number-bond') {
        <mu-number-bond
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('number-wall') {
        <mu-number-wall
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('sequence') {
        <mu-sequence
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('shape-pick') {
        <mu-shape-pick
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('letter-sound') {
        <mu-letter-sound
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('initial-sound') {
        <mu-initial-sound
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('syllables') {
        <mu-syllables
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('word-picture') {
        <mu-word-picture
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
      @case ('build-word') {
        <mu-build-word
          [payload]="payload()"
          [locked]="locked()"
          [reveal]="revealed()"
          [cue]="cue()"
          (answered)="answer($event)"
        />
      }
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
export class ExerciseHost {
  readonly exercise = input.required<ExerciseView>();
  readonly locked = input(false);
  readonly reveal = input<AnyAnswer | null>(null);
  readonly cue = input<DemoAction | null>(null);
  readonly answered = output<AnyAnswer>();

  // The @switch guarantees each component receives the payload and answer of its own type.
  protected readonly payload = computed(() => this.exercise().payload as never);
  protected readonly revealed = computed(() => this.reveal() as never);

  protected answer(answer: AnyAnswer): void {
    this.answered.emit(answer);
  }
}
