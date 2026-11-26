import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { FormError } from '../form-error/form-error';
import { Icon } from '../icon/icon';

@Component({
  selector: 'mu-parent-gate-dialog',
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
    TranslocoPipe,
    FormError,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-gate-dialog.html',
  styles: `
    .intro {
      display: flex;
      gap: var(--mu-space-3);
      align-items: flex-start;
      margin-top: 0;
    }

    mu-icon {
      color: var(--mu-color-secondary);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-2);
    }
  `,
})
export class ParentGateDialog {
  private readonly ref = inject<MatDialogRef<ParentGateDialog, boolean>>(MatDialogRef);
  private readonly auth = inject(AuthService);

  protected readonly email = this.auth.user()?.email ?? '';
  protected readonly password = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);

  protected async submit(): Promise<void> {
    if (this.password.invalid || this.busy()) {
      this.password.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.unlockParentGate(this.password.value);
      this.ref.close(true);
    } catch (error) {
      this.error.set(errorMessage(error));
      this.password.reset();
    } finally {
      this.busy.set(false);
    }
  }
}
