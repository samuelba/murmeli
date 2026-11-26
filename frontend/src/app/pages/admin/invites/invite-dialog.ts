import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { CreatedInvite, ROLES, Role } from '../../../core/api/models';
import { AdminService } from '../../../core/admin/admin.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { emailValidators, fieldErrorKey } from '../../../core/forms/validators';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';

@Component({
  selector: 'mu-invite-dialog',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatSelect,
    MatOption,
    TranslocoPipe,
    FormError,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-dialog.html',
  styles: `
    .url {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-2);
      padding: var(--mu-space-3);
      border-radius: var(--mu-radius-md);
      background: var(--mu-color-surface-alt);
    }

    form mat-form-field {
      width: 100%;
    }
  `,
})
export class InviteDialog {
  private readonly admin = inject(AdminService);
  private readonly clipboard = inject(Clipboard);

  protected readonly roles = ROLES;
  protected readonly fieldError = fieldErrorKey;
  protected readonly created = signal<CreatedInvite | null>(null);
  protected readonly copied = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', emailValidators],
    role: ['parent' as Role],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { email, role } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      this.created.set(await this.admin.createInvite(email.trim(), role));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected copy(url: string): void {
    this.copied.set(this.clipboard.copy(url));
  }
}
