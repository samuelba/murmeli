import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExerciseBase } from '../shared/exercise-base';
import { Pointer } from '../shared/pointer';
import { ValueAnswer } from '../shared/value-answer';
import { formatMoney, unitParts } from './money-format';
import { MoneyPiece } from './money-piece';

/** "Wie viele Franken sind das?": count the coins and notes, answer with the unit shown. */
@Component({
  selector: 'mu-money-total',
  imports: [TranslocoPipe, MoneyPiece, Pointer, ValueAnswer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex__stage stage">
      <ul
        class="mu-purse"
        data-testid="money-items"
        [attr.aria-label]="'learn.ex.money.money' | transloco"
        [class.mu-cue]="highlighted('money', 'objects')"
        [class.counting]="countingAlong()"
      >
        @for (item of items(); track $index) {
          <li [style.--i]="$index"><mu-money-piece [item]="item" /></li>
        }
      </ul>
      <p class="amount" [class.mu-cue]="highlighted('numbers', 'prompt')">
        @if (unit().before) {
          <span aria-hidden="true">{{ unit().before }}</span>
        }
        <span
          class="mu-blank"
          data-testid="answer-blank"
          [class.mu-blank--filled]="shown() !== ''"
          [class.mu-blank--revealed]="reveal() !== null"
          [attr.aria-label]="
            shown() === ''
              ? ('learn.ex.blank' | transloco)
              : ('learn.ex.blankFilled' | transloco: { value: shownMoney() })
          "
        >
          {{ shown() || '?' }}
          @if (pointing() && revealValue() !== null && mode() === 'keypad') {
            <mu-pointer />
          }
        </span>
        @if (unit().after) {
          <span aria-hidden="true">{{ unit().after }}</span>
        }
      </p>
    </div>
    <mu-value-answer
      [mode]="mode()"
      [choices]="choices()"
      [locked]="locked()"
      [revealValue]="revealValue()"
      [pointing]="pointing() && mode() === 'choices'"
      [highlighted]="highlighted('choices')"
      [showBlank]="false"
      (typedChange)="typed.set($event)"
      (answered)="emit({ value: $event })"
    />
  `,
  styles: `
    :host {
      display: contents;
    }

    .stage {
      flex-direction: column;
    }

    .amount {
      display: flex;
      align-items: center;
      gap: var(--mu-space-2);
      margin: 0;
      font: 800 clamp(2rem, 1.6rem + 2vw, 2.75rem) / 1 var(--mu-font-learn);
    }
  `,
})
export class MoneyTotal extends ExerciseBase<'money-chf'> {
  protected readonly typed = signal('');
  protected readonly unit = computed(() =>
    unitParts(this.payload().currency, this.payload().group),
  );
  private readonly total = computed(() => {
    const payload = this.payload();
    return payload.mode === 'total' ? payload : null;
  });
  protected readonly items = computed(() => this.total()?.items ?? []);
  protected readonly mode = computed(() => this.total()?.answerMode ?? 'keypad');
  protected readonly choices = computed(() => this.total()?.choices);
  protected readonly revealValue = computed(() => {
    const reveal = this.reveal();
    return reveal && 'value' in reveal ? reveal.value : null;
  });
  protected readonly shown = computed(() => {
    const value = this.revealValue();
    return value !== null ? String(value) : this.typed();
  });
  protected readonly shownMoney = computed(() =>
    formatMoney(this.shown(), this.payload().currency, this.payload().group),
  );
}
