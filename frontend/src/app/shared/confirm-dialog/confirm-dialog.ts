import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';

export interface ConfirmDialogData {
  readonly titleKey: string;
  readonly messageKey: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly confirmKey: string;
  readonly danger?: boolean;
  /** When set, the user must type this text before confirming. */
  readonly confirmText?: string;
}

@Component({
  selector: 'mu-confirm-dialog',
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
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.titleKey | transloco: data.params }}</h2>
    <mat-dialog-content>
      <p>{{ data.messageKey | transloco: data.params }}</p>
      @if (data.confirmText) {
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{
            'confirm.typeToConfirm' | transloco: { text: data.confirmText }
          }}</mat-label>
          <input matInput data-testid="confirm-text" autocomplete="off" [formControl]="typed" />
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        matButton="text"
        type="button"
        [mat-dialog-close]="false"
        data-testid="confirm-cancel"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        type="button"
        data-testid="confirm-ok"
        [class.mu-danger]="data.danger"
        [disabled]="!matches()"
        [mat-dialog-close]="true"
      >
        {{ data.confirmKey | transloco: data.params }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .full {
      width: 100%;
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  protected readonly typed = new FormControl('', { nonNullable: true });
  protected readonly matches = toSignal(
    this.typed.valueChanges.pipe(map((value) => this.isConfirmed(value))),
    { initialValue: this.isConfirmed('') },
  );

  private isConfirmed(value: string): boolean {
    return !this.data.confirmText || value.trim() === this.data.confirmText;
  }
}
