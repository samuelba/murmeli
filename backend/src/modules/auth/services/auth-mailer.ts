import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sha256Hex } from '../../../common/crypto/secure-token';
import type { Env } from '../../../config/env.schema';
import { EmailService, type SendResult } from '../../email/email.service';
import type { EmailContext, EmailTemplate } from '../../email/email.types';
import type { Locale } from '../../users/user.types';
import { AttemptLimiter } from '../limits/attempt-limiter.service';
import { LimitPolicies } from '../limits/limit-policies';

export interface Recipient {
  readonly email: string;
  readonly locale: Locale;
}

export type MailResult = SendResult | 'dropped';

/** Emails anyone can trigger for an address, limited per recipient and kind */
const LIMITED_KINDS: Readonly<Partial<Record<EmailTemplate, string>>> = {
  'verify-email': 'verify',
  'account-exists': 'verify',
  'password-reset': 'reset',
  'email-change': 'email-change',
};

/**
 * Builds the account emails and their links per the API contract. Emails a
 * stranger can trigger are capped per recipient; beyond the cap they are
 * silently dropped so the API response stays the same.
 */
@Injectable()
export class AuthMailer {
  private readonly logger = new Logger(AuthMailer.name);
  private readonly appUrl: string;

  constructor(
    private readonly email: EmailService,
    private readonly limiter: AttemptLimiter,
    private readonly policies: LimitPolicies,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  get enabled(): boolean {
    return this.email.enabled;
  }

  verifyEmail(to: Recipient, token: string): Promise<MailResult> {
    return this.send('verify-email', to, {
      link: this.tokenLink('verify-email', token),
    });
  }

  accountExists(to: Recipient): Promise<MailResult> {
    return this.send('account-exists', to, {
      loginUrl: `${this.appUrl}/login`,
      resetUrl: `${this.appUrl}/forgot-password`,
    });
  }

  passwordReset(to: Recipient, token: string): Promise<MailResult> {
    return this.send('password-reset', to, {
      link: this.passwordResetUrl(token),
    });
  }

  passwordResetUrl(token: string): string {
    return this.tokenLink('reset-password', token);
  }

  passwordChanged(to: Recipient): Promise<MailResult> {
    return this.send('password-changed', to, {
      resetUrl: `${this.appUrl}/forgot-password`,
    });
  }

  emailChange(to: Recipient, token: string): Promise<MailResult> {
    return this.send('email-change', to, {
      link: this.tokenLink('verify-email', token),
      newEmail: to.email,
    });
  }

  emailChanged(oldAddress: Recipient): Promise<MailResult> {
    return this.send('email-changed', oldAddress, {
      loginUrl: `${this.appUrl}/login`,
    });
  }

  invite(to: Recipient, token: string): Promise<MailResult> {
    return this.send('invite', to, { link: this.inviteUrl(token) });
  }

  inviteUrl(token: string): string {
    return `${this.appUrl}/invite/${encodeURIComponent(token)}`;
  }

  private tokenLink(path: string, token: string): string {
    return `${this.appUrl}/${path}?token=${encodeURIComponent(token)}`;
  }

  private async send(
    template: EmailTemplate,
    to: Recipient,
    context: EmailContext,
  ): Promise<MailResult> {
    if (!this.email.enabled) {
      return 'disabled';
    }
    const kind = LIMITED_KINDS[template];
    if (kind !== undefined && !(await this.withinRecipientLimit(to, kind))) {
      this.logger.warn(`Dropped a ${template} email: recipient limit reached`);
      return 'dropped';
    }
    return this.email.send({
      template,
      to: to.email,
      locale: to.locale,
      context,
    });
  }

  private async withinRecipientLimit(
    to: Recipient,
    kind: string,
  ): Promise<boolean> {
    const key = `${sha256Hex(to.email.trim().toLowerCase())}:${kind}`;
    return (await this.limiter.attempt(this.policies.mailRecipient, key))
      .allowed;
  }
}
