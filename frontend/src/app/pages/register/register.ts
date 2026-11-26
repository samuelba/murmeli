import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { applyServerFieldErrors } from '../../core/forms/server-errors';
import { emailValidators, fieldErrorKey } from '../../core/forms/validators';
import { ApiService } from '../../core/http/api.service';
import { LanguageService } from '../../core/i18n/language.service';
import { LANGUAGES, Language } from '../../core/i18n/languages';
import { Altcha } from '../../shared/altcha/altcha';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { NewPasswordFields, newPasswordGroup } from '../../shared/new-password/new-password';
import { PageCard } from '../../shared/page-card/page-card';

@Component({
  selector: 'mu-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatSelect,
    MatOption,
    TranslocoPipe,
    Altcha,
    FormError,
    Icon,
    NewPasswordFields,
    PageCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
})
export class Register {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly altcha = viewChild(Altcha);

  protected readonly config = inject(AuthService).config;
  protected readonly languages = LANGUAGES;
  protected readonly fieldError = fieldErrorKey;
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly altchaPayload = signal<string | null>(null);
  protected readonly altchaMissing = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', emailValidators],
    passwords: newPasswordGroup(this.fb),
    locale: [inject(LanguageService).language() as Language],
    acceptTerms: [false, Validators.requiredTrue],
  });

  protected onVerified(payload: string | null): void {
    this.altchaPayload.set(payload);
    if (payload) {
      this.altchaMissing.set(false);
    }
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const altcha = this.altchaPayload();
    this.altchaMissing.set(!altcha);
    if (this.form.invalid || !altcha || this.busy()) {
      return;
    }
    const { email, passwords, locale } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.post('auth/register', {
          email: email.trim(),
          password: passwords.password,
          locale,
          acceptTerms: true,
          altcha,
        }),
      );
      this.done.set(true);
    } catch (error) {
      applyServerFieldErrors(this.form, error, { password: 'passwords.password' });
      this.error.set(errorMessage(error));
      this.altcha()?.reset();
    } finally {
      this.busy.set(false);
    }
  }
}
