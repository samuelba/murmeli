import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { ClockChoice } from '@murmeli/content';
import { Icon } from '../../../shared/icon/icon';
import { Speak } from '../../../shared/speak/speak';
import { ExerciseBase } from '../shared/exercise-base';
import { Pointer } from '../shared/pointer';
import { ClockFace } from './clock-face';

/** "Wie spät ist es?": an analog clock and the times to choose from (words, digital or both). */
@Component({
  selector: 'mu-clock',
  imports: [TranslocoPipe, Icon, Speak, Pointer, ClockFace],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex layout">
      <div class="mu-ex__stage stage">
        <mu-clock-face
          data-testid="clock-face"
          [class.mu-cue]="highlighted('clock', 'picture')"
          [hour]="payload().hour"
          [minute]="payload().minute"
          [counting]="countingAlong()"
        />
      </div>
      <ul
        class="choices"
        [attr.aria-label]="'learn.ex.answers' | transloco"
        [class.mu-cue]="highlighted('choices')"
      >
        @for (choice of payload().choices; track choice.id; let i = $index) {
          <li class="option">
            <button
              type="button"
              class="mu-choice choice"
              [class.mu-choice--selected]="choice.id === picked()"
              [class.mu-choice--revealed]="choice.id === revealId()"
              [attr.aria-disabled]="locked() ? 'true' : null"
              [attr.aria-label]="ariaLabel(choice)"
              [attr.data-testid]="'choice-' + choice.id"
              [attr.data-value]="choice.label"
              [style.--mu-choice-tint]="'var(--mu-avatar-bg-' + ((i % 9) + 1) + ')'"
              (click)="pick(choice.id)"
            >
              <span class="words" [class.words--digital]="isDigital(choice.label)">{{
                choice.label
              }}</span>
              @if (choice.digital) {
                <span class="digital">{{ choice.digital }}</span>
              }
              @if (choice.id === revealId()) {
                <span class="mu-choice__badge"><mu-icon name="check" /></span>
                @if (pointing()) {
                  <mu-pointer />
                }
              }
            </button>
            @if (!isDigital(choice.label)) {
              <mu-speak [text]="choice.label" />
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .layout {
      @media (min-width: 720px) {
        flex-direction: row;
        align-items: center;
        justify-content: center;
      }
    }

    .stage {
      width: auto;
    }

    mu-clock-face.mu-cue {
      border-radius: 50%;
    }

    .choices {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-3);
      width: min(100%, 420px);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .option {
      display: flex;
      align-items: center;
      gap: var(--mu-space-2);
    }

    .choice {
      flex: 1;
      flex-direction: column;
      gap: var(--mu-space-1);
      min-height: 72px;
      font-size: clamp(1.3rem, 1.1rem + 1vw, 1.6rem);
      line-height: 1.15;
      text-align: center;
    }

    .words--digital {
      font-size: clamp(1.8rem, 1.5rem + 1.5vw, 2.4rem);
      font-variant-numeric: tabular-nums;
    }

    .digital {
      font-size: 1.1rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      opacity: 0.85;
    }
  `,
})
export class Clock extends ExerciseBase<'clock'> {
  private readonly transloco = inject(TranslocoService);
  protected readonly picked = signal<string | null>(null);
  protected readonly revealId = computed(() => this.reveal()?.choiceId ?? null);

  protected isDigital(label: string): boolean {
    return /^\d{1,2}:\d{2}$/.test(label);
  }

  protected ariaLabel(choice: ClockChoice): string {
    const label = choice.digital ? `${choice.label}, ${choice.digital}` : choice.label;
    return choice.id === this.revealId()
      ? `${label}, ${this.transloco.translate('learn.player.correctLabel')}`
      : label;
  }

  protected pick(id: string): void {
    if (this.locked()) {
      return;
    }
    this.picked.set(id);
    this.emit({ choiceId: id });
  }
}
