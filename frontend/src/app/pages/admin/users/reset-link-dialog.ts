import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { PasswordResetLink } from '../../../core/api/models';
import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../../../shared/icon/icon';

export interface ResetLinkDialogData extends PasswordResetLink {
  readonly email: string;
}

/** Shows a fresh password reset link once, to pass on to the user by another channel. */
@Component({
  selector: 'mu-reset-link-dialog',
  imports: [
    DatePipe,
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    TranslocoPipe,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'admin.users.resetLinkTitle' | transloco }}</h2>
    <mat-dialog-content>
      <div class="url" data-testid="reset-link-result">
        <p class="mu-muted">
          {{
            'admin.users.resetLinkText'
              | transloco
                : {
                    email: data.email,
                    expires: data.expiresAt | date: 'short' : undefined : language(),
                  }
          }}
        </p>
        <p class="mu-code" data-testid="reset-link-url">{{ data.resetUrl }}</p>
        <div class="mu-actions">
          <button matButton="outlined" type="button" data-testid="reset-link-copy" (click)="copy()">
            <mu-icon name="copy" /> {{ 'common.copy' | transloco }}
          </button>
          <span role="status" class="mu-muted">
            @if (copied()) {
              {{ 'common.copied' | transloco }}
            }
          </span>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" mat-dialog-close data-testid="reset-link-done">
        {{ 'common.done' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .url {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-2);
      padding: var(--mu-space-3);
      border-radius: var(--mu-radius-md);
      background: var(--mu-color-surface-alt);
    }
  `,
})
export class ResetLinkDialog {
  private readonly clipboard = inject(Clipboard);

  protected readonly data = inject<ResetLinkDialogData>(MAT_DIALOG_DATA);
  protected readonly language = inject(LanguageService).language;
  protected readonly copied = signal(false);

  protected copy(): void {
    this.copied.set(this.clipboard.copy(this.data.resetUrl));
  }
}
