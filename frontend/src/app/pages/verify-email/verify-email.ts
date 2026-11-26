import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { emailValidators, fieldErrorKey } from '../../core/forms/validators';
import { ApiService } from '../../core/http/api.service';
import { Altcha } from '../../shared/altcha/altcha';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { PageCard } from '../../shared/page-card/page-card';

type State = 'verifying' | 'registration' | 'email_change' | 'failed' | 'resend' | 'resent';

@Component({
  selector: 'mu-verify-email',
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
    Mascot,
    PageCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-email.html',
})
export class VerifyEmail implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly widget = viewChild(Altcha);

  protected readonly fieldError = fieldErrorKey;
  protected readonly state = signal<State>('resend');
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly altcha = signal<string | null>(null);
  protected readonly email = inject(FormBuilder).nonNullable.control('', emailValidators);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.email.setValue(params.get('email') ?? '');
    const token = params.get('token');
    if (token) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { token: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      void this.verify(token);
    }
  }

  protected async resend(): Promise<void> {
    this.email.markAsTouched();
    const altcha = this.altcha();
    if (this.email.invalid || !altcha || this.busy()) {
      this.error.set(altcha ? null : { key: 'register.altchaRequired' });
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.post('auth/resend-verification', { email: this.email.value.trim(), altcha }),
      );
      this.state.set('resent');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
      this.widget()?.reset();
    }
  }

  private async verify(token: string): Promise<void> {
    this.state.set('verifying');
    try {
      const { type } = await firstValueFrom(
        this.api.post<{ type: 'registration' | 'email_change' }>('auth/verify-email', { token }),
      );
      this.state.set(type === 'email_change' ? 'email_change' : 'registration');
    } catch (error) {
      this.error.set(errorMessage(error));
      this.state.set('failed');
    }
  }
}
