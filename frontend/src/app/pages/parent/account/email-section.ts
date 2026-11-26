import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountService } from '../../../core/account/account.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { emailValidators, fieldErrorKey } from '../../../core/forms/validators';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';

@Component({
  selector: 'mu-email-section',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    TranslocoPipe,
    FormError,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="email-heading" class="mu-section-title">{{ 'account.emailTitle' | transloco }}</h2>
    <p class="mu-muted">{{ 'account.currentEmail' | transloco: { email: user()?.email } }}</p>
    <form class="mu-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'fields.newEmail' | transloco }}</mat-label>
        <input
          matInput
          type="email"
          autocomplete="email"
          formControlName="newEmail"
          data-testid="new-email"
        />
        <mat-error>{{ fieldError(form.controls.newEmail) ?? '' | transloco }}</mat-error>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'fields.currentPassword' | transloco }}</mat-label>
        <input
          matInput
          type="password"
          autocomplete="current-password"
          formControlName="password"
        />
        <mat-error>{{ fieldError(form.controls.password) ?? '' | transloco }}</mat-error>
      </mat-form-field>
      @if (sentTo(); as email) {
        <p class="mu-notice mu-notice--success" role="status">
          <mu-icon name="success" /><span>{{ 'account.emailSent' | transloco: { email } }}</span>
        </p>
      }
      <mu-form-error [error]="error()" />
      <div class="mu-actions">
        <button matButton="filled" type="submit" [disabled]="busy()">
          {{ 'account.emailSubmit' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class EmailSection {
  private readonly account = inject(AccountService);

  protected readonly user = inject(AuthService).user;
  protected readonly fieldError = fieldErrorKey;
  protected readonly busy = signal(false);
  protected readonly sentTo = signal<string | null>(null);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    newEmail: ['', emailValidators],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { newEmail, password } = this.form.getRawValue();
    this.busy.set(true);
    this.sentTo.set(null);
    this.error.set(null);
    try {
      await this.account.changeEmail(newEmail.trim(), password);
      this.sentTo.set(newEmail.trim());
      this.form.reset();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
