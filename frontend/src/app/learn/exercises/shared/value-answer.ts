import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AnswerMode, Choice } from '@murmeli/content';
import { ChoiceItem, Choices } from './choices';
import { Keypad } from './keypad';
import { KeypadKey, applyKey, entryValue } from './number-entry';
import { Pointer } from './pointer';

/**
 * The answer part of every "type one number" exercise: number choices (answer on tap) or the
 * keypad with a blank showing the typed number (answer on OK).
 */
@Component({
  selector: 'mu-value-answer',
  imports: [TranslocoPipe, Choices, Keypad, Pointer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'choices' && choices()) {
      <mu-choices
        [choices]="choices()!"
        [label]="'learn.ex.answers' | transloco"
        [locked]="locked()"
        [revealId]="revealId()"
        [pointing]="pointing()"
        [highlighted]="highlighted()"
        (picked)="pick($event)"
      />
    } @else {
      <div class="keypad-answer">
        @if (showBlank()) {
          <output
            class="mu-blank"
            data-testid="answer-blank"
            aria-live="polite"
            [class.mu-blank--filled]="typed() !== ''"
            [class.mu-blank--revealed]="revealValue() !== null"
            [attr.aria-label]="
              shown() === ''
                ? ('learn.ex.keypad.empty' | transloco)
                : ('learn.ex.keypad.display' | transloco: { value: shown() })
            "
          >
            {{ shown() || '?' }}
            @if (pointing() && revealValue() !== null) {
              <mu-pointer />
            }
          </output>
        }
        <mu-keypad
          [locked]="locked()"
          [canSubmit]="typed() !== ''"
          [captureKeys]="!locked()"
          (pressed)="press($event)"
        />
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      justify-content: center;
      width: 100%;
    }

    .keypad-answer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-4);
      width: 100%;
    }

    .mu-blank {
      min-width: 112px;
    }
  `,
})
export class ValueAnswer {
  readonly mode = input<AnswerMode>('choices');
  readonly choices = input<readonly Choice[] | undefined>(undefined);
  readonly locked = input(false, { transform: booleanAttribute });
  readonly revealValue = input<number | null>(null);
  readonly pointing = input(false, { transform: booleanAttribute });
  readonly highlighted = input(false, { transform: booleanAttribute });
  /** False when the exercise shows the typed number in its own blank. */
  readonly showBlank = input(true, { transform: booleanAttribute });
  readonly maxDigits = input(3);
  readonly answered = output<number>();
  readonly typedChange = output<string>();

  protected readonly typed = signal('');
  protected readonly shown = computed(() => {
    const reveal = this.revealValue();
    return reveal !== null ? String(reveal) : this.typed();
  });
  protected readonly revealId = computed(() => {
    const reveal = this.revealValue();
    return reveal === null
      ? null
      : (this.choices()?.find((choice) => choice.value === reveal)?.id ?? null);
  });

  protected pick(choice: ChoiceItem): void {
    if (choice.value !== undefined) {
      this.answered.emit(choice.value);
    }
  }

  protected press(key: KeypadKey): void {
    if (key === 'ok') {
      const value = entryValue(this.typed());
      if (value !== null) {
        this.answered.emit(value);
      }
      return;
    }
    this.typed.update((text) => applyKey(text, key, this.maxDigits()));
    this.typedChange.emit(this.typed());
  }
}
