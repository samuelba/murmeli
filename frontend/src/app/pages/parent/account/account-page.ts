import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TOTP_REQUIRED_NOTICE } from '../../../core/auth/totp-required.interceptor';
import { PageCard } from '../../../shared/page-card/page-card';
import { DataSection } from './data-section';
import { EmailSection } from './email-section';
import { PasswordSection } from './password-section';
import { PreferencesSection } from './preferences-section';
import { TotpSection } from './totp-section';

@Component({
  selector: 'mu-account-page',
  imports: [
    TranslocoPipe,
    PageCard,
    PreferencesSection,
    PasswordSection,
    EmailSection,
    TotpSection,
    DataSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-stack">
      <h1 id="page-heading" class="mu-page-title" data-testid="page-title">
        {{ 'account.title' | transloco }}
      </h1>
      <mu-page-card headingId="prefs-heading"><mu-preferences-section /></mu-page-card>
      <mu-page-card headingId="password-heading"><mu-password-section /></mu-page-card>
      <mu-page-card headingId="email-heading"><mu-email-section /></mu-page-card>
      <mu-page-card headingId="totp-heading" id="totp">
        <mu-totp-section [required]="totpRequired" />
      </mu-page-card>
      <mu-page-card headingId="data-heading"><mu-data-section /></mu-page-card>
    </div>
  `,
})
export class AccountPage {
  protected readonly totpRequired =
    inject(ActivatedRoute).snapshot.queryParamMap.get('notice') === TOTP_REQUIRED_NOTICE;
}
