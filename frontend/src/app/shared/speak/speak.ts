import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';
import { SPEAK_PROVIDER, SpeechInput } from './speak-provider';

/** Read-aloud button; hidden until the audio provider has a clip for the text. */
@Component({
  selector: 'mu-speak',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <button
        type="button"
        class="speak"
        data-testid="speak"
        [attr.aria-label]="'common.readAloud' | transloco: { text: text() }"
        [attr.title]="'common.readAloudShort' | transloco"
        (click)="play()"
      >
        <mu-icon name="speaker" />
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    :host:empty {
      display: none;
    }

    .speak {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--mu-touch-target);
      height: var(--mu-touch-target);
      border: 0;
      border-radius: 50%;
      background: var(--mu-color-secondary);
      color: var(--mu-color-on-secondary);
      cursor: pointer;
      box-shadow: 0 4px 0 rgb(0 0 0 / 0.2);

      mu-icon {
        width: 55%;
        height: 55%;
      }

      &:active {
        transform: translateY(3px);
        box-shadow: 0 1px 0 rgb(0 0 0 / 0.2);
      }
    }
  `,
})
export class Speak {
  private readonly provider = inject(SPEAK_PROVIDER, { optional: true });

  /** What the button is labelled with and, without `segments`, what is spoken. */
  readonly text = input.required<string>();
  /** Manifest segments to play instead of `text` (prompt.speak). */
  readonly segments = input<readonly string[] | null>(null);

  private readonly speech = computed<SpeechInput>(() => this.segments() ?? this.text());

  protected readonly visible = computed(() => {
    const provider = this.provider;
    if (!provider) {
      return false;
    }
    const available = provider.available?.() ?? true;
    return available && (provider.canSpeak?.(this.speech()) ?? true);
  });

  constructor() {
    this.provider?.prepare?.();
  }

  protected play(): void {
    this.provider?.speak(this.speech());
  }
}
