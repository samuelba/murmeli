import type { Locale } from '../users/user.types';

export const EMAIL_QUEUE = 'email';
export const EMAIL_LOGO_PATH = '/brand/murmeli-mark.png';

export const EMAIL_TEMPLATES = [
  'verify-email',
  'account-exists',
  'password-reset',
  'password-changed',
  'email-change',
  'invite',
  'email-changed',
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export type EmailStatus = 'sent' | 'queued' | 'disabled';

export type EmailContext = Readonly<Record<string, string>>;

export interface EmailMessage {
  readonly template: EmailTemplate;
  readonly to: string;
  readonly locale: Locale;
  readonly context: EmailContext;
}

/**
 * Queue payload. The context holds links with single-use tokens, so it is
 * stored encrypted (`sealedContext`) and never readable in Redis.
 */
export interface EmailJob {
  readonly template: EmailTemplate;
  readonly to: string;
  readonly locale: Locale;
  readonly sealedContext: string;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}
