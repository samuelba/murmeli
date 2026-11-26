import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountService } from '../../../core/account/account.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { fieldErrorKey } from '../../../core/forms/validators';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';
import { NewPasswordFields, newPasswordGroup } from '../../../shared/new-password/new-password';

@Component({
  selector: 'mu-password-section',
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
    NewPasswordFields,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="password-heading" class="mu-section-title">
      {{ 'account.passwordTitle' | transloco }}
    </h2>
    <form class="mu-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <input
        type="email"
        class="mu-visually-hidden"
        autocomplete="username"
        tabindex="-1"
        aria-hidden="true"
        [value]="email"
        readonly
      />
      <mat-form-field appearance="outline">
        <mat-label>{{ 'fields.currentPassword' | transloco }}</mat-label>
        <input
          matInput
          type="password"
          autocomplete="current-password"
          formControlName="currentPassword"
          data-testid="current-password"
        />
        <mat-error>{{ fieldError(form.controls.currentPassword) ?? '' | transloco }}</mat-error>
      </mat-form-field>
      <mu-new-password [group]="form.controls.passwords" />
      @if (done()) {
        <p class="mu-notice mu-notice--success" role="status">
          <mu-icon name="success" /><span>{{ 'account.passwordChanged' | transloco }}</span>
        </p>
      }
      <mu-form-error [error]="error()" />
      <div class="mu-actions">
        <button matButton="filled" type="submit" data-testid="password-submit" [disabled]="busy()">
          {{ 'account.passwordSubmit' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class PasswordSection {
  private readonly account = inject(AccountService);
  private readonly fb = inject(FormBuilder);

  protected readonly email = inject(AuthService).user()?.email ?? '';
  protected readonly fieldError = fieldErrorKey;
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    passwords: newPasswordGroup(this.fb),
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { currentPassword, passwords } = this.form.getRawValue();
    this.busy.set(true);
    this.done.set(false);
    this.error.set(null);
    try {
      await this.account.changePassword(currentPassword, passwords.password);
      this.done.set(true);
      this.form.reset();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
