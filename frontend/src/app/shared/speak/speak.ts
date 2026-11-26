import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';
import { SPEAK_PROVIDER } from './speak-provider';

/** Read-aloud button; hidden until an audio provider (SPEAK_PROVIDER) is registered. */
@Component({
  selector: 'mu-speak',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (provider) {
      <button
        type="button"
        class="speak"
        data-testid="speak"
        [attr.aria-label]="'common.readAloud' | transloco: { text: text() }"
        [attr.title]="'common.readAloudShort' | transloco"
        (click)="provider.speak(text())"
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
  protected readonly provider = inject(SPEAK_PROVIDER, { optional: true });

  readonly text = input.required<string>();
}
