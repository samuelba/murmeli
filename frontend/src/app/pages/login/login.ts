import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/return-url';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { emailValidators, fieldErrorKey } from '../../core/forms/validators';
import { errorCodeOf } from '../../core/http/api-error';
import { FormError } from '../../shared/form-error/form-error';
import { PageCard } from '../../shared/page-card/page-card';

type Step = 'credentials' | 'totp';

@Component({
  selector: 'mu-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatHint,
    TranslocoPipe,
    FormError,
    PageCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly fieldError = fieldErrorKey;
  protected readonly config = this.auth.config;
  protected readonly step = signal<Step>('credentials');
  protected readonly useRecoveryCode = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly unverified = signal(false);

  protected readonly credentials = this.fb.group({
    email: ['', emailValidators],
    password: ['', Validators.required],
  });
  protected readonly totp = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    recoveryCode: [''],
  });

  protected async signIn(): Promise<void> {
    if (!this.validate(this.credentials)) {
      return;
    }
    const { email, password } = this.credentials.getRawValue();
    await this.run(async () => {
      const outcome = await this.auth.login(email.trim(), password);
      if (outcome === 'totp-required') {
        this.step.set('totp');
        return;
      }
      await this.finish();
    });
  }

  protected async verify(): Promise<void> {
    if (!this.validate(this.totp)) {
      return;
    }
    const { code, recoveryCode } = this.totp.getRawValue();
    await this.run(async () => {
      await this.auth.verifyTotp(
        this.useRecoveryCode() ? { recoveryCode: recoveryCode.trim() } : { code },
      );
      await this.finish();
    });
  }

  protected toggleRecovery(): void {
    const recovery = !this.useRecoveryCode();
    this.useRecoveryCode.set(recovery);
    this.error.set(null);
    const { code, recoveryCode } = this.totp.controls;
    code.setValidators(recovery ? [] : [Validators.required, Validators.pattern(/^\d{6}$/)]);
    recoveryCode.setValidators(recovery ? [Validators.required] : []);
    code.reset();
    recoveryCode.reset();
  }

  protected backToCredentials(): void {
    this.step.set('credentials');
    this.error.set(null);
    this.totp.reset();
  }

  private validate(form: AbstractControl): boolean {
    form.markAllAsTouched();
    return form.valid && !this.busy();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.unverified.set(false);
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessage(error));
      this.unverified.set(errorCodeOf(error) === 'EMAIL_NOT_VERIFIED');
    } finally {
      this.busy.set(false);
    }
  }

  private async finish(): Promise<void> {
    const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    await this.router.navigateByUrl(returnUrl);
  }
}
