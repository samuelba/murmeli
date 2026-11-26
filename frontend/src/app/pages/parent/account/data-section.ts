import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AccountService } from '../../../core/account/account.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { injectConfirm } from '../../../shared/confirm-dialog/confirm';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';

@Component({
  selector: 'mu-data-section',
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
    <h2 id="data-heading" class="mu-section-title">{{ 'account.dataTitle' | transloco }}</h2>
    <p class="mu-muted">{{ 'account.exportIntro' | transloco }}</p>
    <div class="mu-actions">
      <button
        matButton="outlined"
        type="button"
        data-testid="export-data"
        [disabled]="busy()"
        (click)="exportData()"
      >
        <mu-icon name="download" /> {{ 'account.export' | transloco }}
      </button>
    </div>
    <h3 class="sub">{{ 'account.deleteTitle' | transloco }}</h3>
    <p class="mu-muted">{{ 'account.deleteIntro' | transloco }}</p>
    <form class="mu-form" (submit)="$event.preventDefault(); deleteAccount()" novalidate>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'fields.currentPassword' | transloco }}</mat-label>
        <input
          matInput
          type="password"
          autocomplete="current-password"
          [formControl]="password"
          data-testid="delete-password"
        />
        <mat-error>{{ 'forms.required' | transloco }}</mat-error>
      </mat-form-field>
      <div class="mu-actions">
        <button
          matButton="filled"
          type="submit"
          class="mu-danger"
          data-testid="delete-account"
          [disabled]="busy()"
        >
          <mu-icon name="delete" /> {{ 'account.delete' | transloco }}
        </button>
      </div>
    </form>
    <mu-form-error [error]="error()" />
  `,
})
export class DataSection {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly confirm = injectConfirm();

  protected readonly password = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);

  protected async exportData(): Promise<void> {
    await this.run(() => this.account.exportData());
  }

  protected async deleteAccount(): Promise<void> {
    this.password.markAsTouched();
    if (this.password.invalid) {
      return;
    }
    const confirmed = await this.confirm({
      titleKey: 'account.deleteConfirmTitle',
      messageKey: 'account.deleteConfirmMessage',
      confirmKey: 'account.delete',
      confirmText: this.transloco.translate('account.deleteWord'),
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    await this.run(async () => {
      await this.account.deleteAccount(this.password.value);
      await this.router.navigateByUrl('/');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
