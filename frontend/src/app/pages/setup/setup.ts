import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { BRAND_NAME } from '../../core/brand';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { applyServerFieldErrors } from '../../core/forms/server-errors';
import { emailValidators, fieldErrorKey } from '../../core/forms/validators';
import { LanguageService } from '../../core/i18n/language.service';
import { LANGUAGES, Language } from '../../core/i18n/languages';
import { FormError } from '../../shared/form-error/form-error';
import { Mascot } from '../../shared/mascot/mascot';
import { NewPasswordFields, newPasswordGroup } from '../../shared/new-password/new-password';
import { PageCard } from '../../shared/page-card/page-card';

@Component({
  selector: 'mu-setup',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatSelect,
    MatOption,
    TranslocoPipe,
    FormError,
    Mascot,
    NewPasswordFields,
    PageCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mu-page-card narrow>
      <mu-mascot pose="happy" class="mascot" />
      <h1 id="page-heading" class="mu-page-title" data-testid="page-title">
        {{ 'setup.title' | transloco: brand }}
      </h1>
      <p class="mu-muted">{{ 'setup.intro' | transloco }}</p>
      <form class="mu-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'fields.email' | transloco }}</mat-label>
          <input
            matInput
            type="email"
            autocomplete="username"
            formControlName="email"
            data-testid="setup-email"
          />
          <mat-error>{{ fieldError(form.controls.email) ?? '' | transloco }}</mat-error>
        </mat-form-field>
        <mu-new-password [group]="form.controls.passwords" labelKey="fields.password" />
        <mat-form-field appearance="outline">
          <mat-label>{{ 'fields.locale' | transloco }}</mat-label>
          <mat-select formControlName="locale" data-testid="setup-locale">
            @for (language of languages; track language) {
              <mat-option [value]="language">{{ 'language.' + language | transloco }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mu-form-error [error]="error()" />
        <div class="mu-actions">
          <button matButton="filled" type="submit" data-testid="setup-submit" [disabled]="busy()">
            {{ 'setup.submit' | transloco }}
          </button>
        </div>
      </form>
    </mu-page-card>
  `,
  styles: `
    .mascot {
      align-self: center;
    }
  `,
})
export class Setup {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly brand = { brand: BRAND_NAME };
  protected readonly languages = LANGUAGES;
  protected readonly fieldError = fieldErrorKey;
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', emailValidators],
    passwords: newPasswordGroup(this.fb),
    locale: [inject(LanguageService).language() as Language],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { email, passwords, locale } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.setup({ email: email.trim(), password: passwords.password, locale });
      await this.router.navigateByUrl('/');
    } catch (error) {
      applyServerFieldErrors(this.form, error, { password: 'passwords.password' });
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
