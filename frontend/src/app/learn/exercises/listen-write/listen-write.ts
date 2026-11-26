import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';
import { SPEAK_PROVIDER } from '../../../shared/speak/speak-provider';
import { ExerciseBase } from '../shared/exercise-base';
import { LetterTiles } from '../shared/letter-tiles';

/**
 * Listen and write (a light dictation): the word is only heard. A big button plays the prompt
 * again; the kid writes the word with letter tiles.
 */
@Component({
  selector: 'mu-listen-write',
  imports: [TranslocoPipe, Icon, LetterTiles],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage stage">
        <button
          type="button"
          class="replay"
          data-testid="replay"
          [class.mu-cue]="highlighted('prompt', 'word', 'picture')"
          [attr.aria-disabled]="speech() === null ? 'true' : null"
          (click)="replay()"
        >
          <span class="replay__icon"><mu-icon name="speaker" /></span>
          <span class="replay__text">{{ 'learn.ex.listen.replay' | transloco }}</span>
        </button>
      </div>
      <mu-letter-tiles
        [length]="payload().length"
        [tiles]="payload().tiles"
        [locked]="locked()"
        [revealed]="revealed()"
        [pointing]="pointing()"
        [highlightTiles]="highlighted('tiles', 'letters')"
        (answered)="emit({ letters: $event })"
      />
    </div>
  `,
  styles: `
    .replay {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-2);
      padding: var(--mu-space-3) var(--mu-space-5);
      border: 0;
      border-radius: var(--mu-radius-chunky);
      background: transparent;
      color: var(--mu-color-text);
      font: inherit;
      font-weight: 800;
      font-size: var(--mu-font-size-lg);
      cursor: pointer;
      touch-action: manipulation;

      &:focus-visible {
        outline: 5px solid var(--mu-color-focus);
        outline-offset: 3px;
      }
    }

    .replay__icon {
      display: grid;
      place-items: center;
      width: clamp(96px, 28vw, 128px);
      height: clamp(96px, 28vw, 128px);
      border-radius: 50%;
      background: var(--mu-color-secondary);
      color: var(--mu-color-on-secondary);
      box-shadow: 0 6px 0 rgb(0 0 0 / 0.25);
      animation: mu-bob 2.4s ease-in-out infinite;

      mu-icon {
        width: 58%;
        height: 58%;
      }
    }

    .replay:active .replay__icon {
      transform: translateY(4px);
      box-shadow: 0 2px 0 rgb(0 0 0 / 0.25);
    }

    @media (prefers-reduced-motion: reduce) {
      .replay__icon {
        animation: none;
      }
    }
  `,
})
export class ListenWrite extends ExerciseBase<'listen-write'> {
  private readonly speaker = inject(SPEAK_PROVIDER, { optional: true });

  /** What to say again: the prompt's speak segments (they contain the word). */
  readonly speech = input<readonly string[] | null>(null);

  protected readonly revealed = computed(() => this.reveal()?.letters ?? null);

  protected replay(): void {
    const speech = this.speech();
    if (speech && speech.length > 0) {
      this.speaker?.speak(speech);
    }
  }
}
