import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { passwordStrength } from '../../core/forms/validators';

const LABELS = ['empty', 'weak', 'fair', 'good', 'strong'] as const;

@Component({
  selector: 'mu-password-strength',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="meter" data-testid="password-strength" [attr.data-score]="score()">
      <div
        class="bar"
        role="meter"
        aria-valuemin="0"
        aria-valuemax="4"
        [attr.aria-valuenow]="score()"
        [attr.aria-valuetext]="'password.strength.' + label() | transloco"
        [attr.aria-label]="'password.strength.label' | transloco"
      >
        @for (segment of segments; track segment) {
          <span class="segment" [class.on]="segment <= score()"></span>
        }
      </div>
      <span class="text" aria-hidden="true">
        {{ 'password.strength.label' | transloco }}:
        {{ 'password.strength.' + label() | transloco }}
      </span>
    </div>
  `,
  styles: `
    .meter {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-1);
      font-size: var(--mu-font-size-sm);
      color: var(--mu-color-text-muted);
    }

    .bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
    }

    .segment {
      height: 8px;
      border-radius: var(--mu-radius-pill);
      background: var(--mu-color-border);
    }

    [data-score='1'] .on {
      background: var(--mu-color-error);
    }

    [data-score='2'] .on {
      background: var(--mu-color-warning);
    }

    [data-score='3'] .on,
    [data-score='4'] .on {
      background: var(--mu-color-success);
    }
  `,
})
export class PasswordStrengthMeter {
  readonly password = input('');

  protected readonly segments = [1, 2, 3, 4];
  protected readonly score = computed(() => passwordStrength(this.password()));
  protected readonly label = computed(() => LABELS[this.score()]);
}
