import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { emailValidators, fieldErrorKey } from '../../core/forms/validators';
import { ApiService } from '../../core/http/api.service';
import { Altcha } from '../../shared/altcha/altcha';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { PageCard } from '../../shared/page-card/page-card';

@Component({
  selector: 'mu-forgot-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    TranslocoPipe,
    Altcha,
    FormError,
    Icon,
    PageCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mu-page-card narrow>
      <h1 id="page-heading" class="mu-page-title" data-testid="page-title">
        {{ 'forgotPassword.title' | transloco }}
      </h1>
      @if (done()) {
        <p class="mu-notice mu-notice--success" role="status" data-testid="forgot-done">
          <mu-icon name="success" />
          <span>{{ 'forgotPassword.done' | transloco }}</span>
        </p>
        <a class="mu-link" routerLink="/login">{{ 'register.toLogin' | transloco }}</a>
      } @else {
        <p class="mu-muted">{{ 'forgotPassword.intro' | transloco }}</p>
        <form class="mu-form" (submit)="$event.preventDefault(); submit()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'fields.email' | transloco }}</mat-label>
            <input
              matInput
              type="email"
              autocomplete="email"
              [formControl]="email"
              data-testid="forgot-email"
            />
            <mat-error>{{ fieldError(email) ?? '' | transloco }}</mat-error>
          </mat-form-field>
          <mu-altcha (verified)="altcha.set($event)" />
          <mu-form-error [error]="error()" />
          <div class="mu-actions">
            <button
              matButton="filled"
              type="submit"
              data-testid="forgot-submit"
              [disabled]="busy()"
            >
              {{ 'forgotPassword.submit' | transloco }}
            </button>
            <a class="mu-link" routerLink="/login">{{ 'common.back' | transloco }}</a>
          </div>
        </form>
      }
    </mu-page-card>
  `,
})
export class ForgotPassword {
  private readonly api = inject(ApiService);
  private readonly widget = viewChild(Altcha);

  protected readonly fieldError = fieldErrorKey;
  protected readonly email = inject(FormBuilder).nonNullable.control('', emailValidators);
  protected readonly altcha = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);

  protected async submit(): Promise<void> {
    this.email.markAsTouched();
    const altcha = this.altcha();
    if (this.email.invalid || this.busy()) {
      return;
    }
    if (!altcha) {
      this.error.set({ key: 'register.altchaRequired' });
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.post('auth/forgot-password', { email: this.email.value.trim(), altcha }),
      );
      this.done.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
      this.widget()?.reset();
    }
  }
}
