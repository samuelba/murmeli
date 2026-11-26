import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ErrorMessage } from '../../core/errors/error-message';
import { Icon } from '../icon/icon';

@Component({
  selector: 'mu-form-error',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="live" role="alert" aria-live="assertive">
      @if (error(); as message) {
        <p class="message" data-testid="form-error">
          <mu-icon name="error" />
          <span>{{ message.key | transloco: message.params }}</span>
        </p>
      }
    </div>
  `,
  styles: `
    .message {
      display: flex;
      align-items: flex-start;
      gap: var(--mu-space-2);
      margin: 0;
      padding: var(--mu-space-3) var(--mu-space-4);
      border-radius: var(--mu-radius-md);
      border: 2px solid var(--mu-color-error-text);
      background: var(--mu-color-surface);
      color: var(--mu-color-error-text);
      font-weight: 700;
    }

    mu-icon {
      margin-top: 2px;
    }
  `,
})
export class FormError {
  readonly error = input<ErrorMessage | null>(null);
}
