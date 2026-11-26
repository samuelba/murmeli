import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { ApiService } from '../../core/http/api.service';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { NewPasswordFields, newPasswordGroup } from '../../shared/new-password/new-password';
import { PageCard } from '../../shared/page-card/page-card';

@Component({
  selector: 'mu-reset-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    TranslocoPipe,
    FormError,
    Icon,
    NewPasswordFields,
    PageCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mu-page-card narrow>
      <h1 id="page-heading" class="mu-page-title" data-testid="page-title">
        {{ 'resetPassword.title' | transloco }}
      </h1>
      @if (!token) {
        <mu-form-error [error]="{ key: 'errors.TOKEN_INVALID' }" />
        <a class="mu-link" routerLink="/forgot-password">{{
          'resetPassword.requestNew' | transloco
        }}</a>
      } @else if (done()) {
        <p class="mu-notice mu-notice--success" role="status" data-testid="reset-done">
          <mu-icon name="success" />
          <span>{{ 'resetPassword.done' | transloco }}</span>
        </p>
        <a class="mu-link" routerLink="/login">{{ 'register.toLogin' | transloco }}</a>
      } @else {
        <form class="mu-form" (submit)="$event.preventDefault(); submit()" novalidate>
          <mu-new-password [group]="passwords" />
          <mu-form-error [error]="error()" />
          <div class="mu-actions">
            <button matButton="filled" type="submit" data-testid="reset-submit" [disabled]="busy()">
              {{ 'resetPassword.submit' | transloco }}
            </button>
            @if (error()?.key === 'errors.TOKEN_INVALID') {
              <a class="mu-link" routerLink="/forgot-password">{{
                'resetPassword.requestNew' | transloco
              }}</a>
            }
          </div>
        </form>
      }
    </mu-page-card>
  `,
})
export class ResetPassword implements OnInit {
  private readonly api = inject(ApiService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly token = this.route.snapshot.queryParamMap.get('token');
  protected readonly passwords = newPasswordGroup(inject(FormBuilder));
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);

  ngOnInit(): void {
    if (this.token) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { token: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected async submit(): Promise<void> {
    this.passwords.markAllAsTouched();
    if (this.passwords.invalid || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.post('auth/reset-password', {
          token: this.token,
          password: this.passwords.controls.password.value,
        }),
      );
      this.done.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
