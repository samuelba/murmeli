import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButton } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountService } from '../../../core/account/account.service';
import { BRAND_NAME } from '../../../core/brand';
import { Icon } from '../../../shared/icon/icon';

@Component({
  selector: 'mu-recovery-codes',
  imports: [MatButton, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="codes" data-testid="recovery-codes">
      <p class="mu-notice">
        <mu-icon name="warning" /><span>{{ 'totp.recoveryIntro' | transloco }}</span>
      </p>
      <ul class="list mu-code" role="list">
        @for (code of codes(); track code) {
          <li>{{ code }}</li>
        }
      </ul>
      <div class="mu-actions">
        <button matButton="outlined" type="button" (click)="download()">
          <mu-icon name="download" /> {{ 'totp.download' | transloco }}
        </button>
        <button matButton="outlined" type="button" (click)="copy()">
          <mu-icon name="copy" /> {{ 'common.copy' | transloco }}
        </button>
        <span role="status" class="mu-muted">
          @if (copied()) {
            {{ 'common.copied' | transloco }}
          }
        </span>
      </div>
    </div>
  `,
  styles: `
    .codes {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-3);
    }

    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--mu-space-2);
      margin: 0;
      padding: var(--mu-space-3);
      border-radius: var(--mu-radius-md);
      background: var(--mu-color-surface-alt);
      list-style: none;
      font-size: var(--mu-font-size-lg);
    }
  `,
})
export class RecoveryCodesView {
  private readonly account = inject(AccountService);
  private readonly clipboard = inject(Clipboard);

  readonly codes = input.required<readonly string[]>();
  protected readonly copied = signal(false);

  protected download(): void {
    this.account.downloadText(
      `${BRAND_NAME} recovery codes\n\n${this.codes().join('\n')}\n`,
      `${BRAND_NAME.toLowerCase()}-recovery-codes.txt`,
    );
  }

  protected copy(): void {
    this.copied.set(this.clipboard.copy(this.codes().join('\n')));
  }
}
