import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { InviteDetails } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { LanguageService } from '../../core/i18n/language.service';
import { LANGUAGES, Language } from '../../core/i18n/languages';
import { FormError } from '../../shared/form-error/form-error';
import { Mascot } from '../../shared/mascot/mascot';
import { NewPasswordFields, newPasswordGroup } from '../../shared/new-password/new-password';
import { PageCard } from '../../shared/page-card/page-card';

@Component({
  selector: 'mu-invite',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    TranslocoPipe,
    FormError,
    Mascot,
    NewPasswordFields,
    PageCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite.html',
})
export class Invite implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly languages = LANGUAGES;
  protected readonly invite = signal<InviteDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<ErrorMessage | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    passwords: newPasswordGroup(this.fb),
    locale: [inject(LanguageService).language() as Language],
    acceptTerms: [false, Validators.requiredTrue],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.invite.set(await this.auth.inviteDetails(this.token));
    } catch (error) {
      this.loadError.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { passwords, locale } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.acceptInvite(this.token, passwords.password, locale);
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
