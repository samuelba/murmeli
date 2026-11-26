import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdminSettings } from '../../../core/api/models';
import { AdminService } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';
import { PageCard } from '../../../shared/page-card/page-card';

type Toggle = 'registrationEnabled' | 'requireAdminTotp';

@Component({
  selector: 'mu-admin-settings',
  imports: [MatSlideToggle, TranslocoPipe, FormError, Icon, PageCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mu-page-card headingId="settings-heading">
      <h2 id="settings-heading" class="mu-section-title">
        {{ 'admin.settings.title' | transloco }}
      </h2>
      @if (settings(); as data) {
        @for (key of toggles; track key) {
          <div class="row">
            <mat-slide-toggle
              [checked]="data[key]"
              [disabled]="busy()"
              [attr.data-testid]="'setting-' + key"
              (change)="update(key, $event)"
            >
              {{ 'admin.settings.' + key | transloco }}
            </mat-slide-toggle>
            <p class="mu-muted">{{ 'admin.settings.' + key + 'Hint' | transloco }}</p>
          </div>
        }
        <p class="mu-notice">
          <mu-icon name="info" />
          <span>{{
            (data.emailEnabled ? 'admin.settings.emailOn' : 'admin.settings.emailOff') | transloco
          }}</span>
        </p>
      }
      <p class="mu-muted" role="status">
        @if (saved()) {
          {{ 'common.saved' | transloco }}
        }
      </p>
      <mu-form-error [error]="error()" />
    </mu-page-card>
  `,
  styles: `
    .row {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-1);
    }
  `,
})
export class AdminSettingsPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);

  protected readonly toggles: readonly Toggle[] = ['registrationEnabled', 'requireAdminTotp'];
  protected readonly settings = signal<AdminSettings | null>(null);
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.settings.set(await this.admin.settings());
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  protected async update(key: Toggle, event: MatSlideToggleChange): Promise<void> {
    const previous = this.settings();
    if (!previous) {
      return;
    }
    this.busy.set(true);
    this.saved.set(false);
    this.error.set(null);
    try {
      await this.admin.updateSettings({ [key]: event.checked });
      this.settings.set({ ...previous, [key]: event.checked });
      this.saved.set(true);
      await this.auth.loadConfig(true).catch(() => null);
    } catch (error) {
      event.source.checked = previous[key];
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
