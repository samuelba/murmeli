import { BRAND_NAME } from '../../config/brand';
import type { Locale } from '../users/user.types';
import type { EmailTemplate } from './email.types';

export const EMAIL_SUBJECTS: Readonly<
  Record<Locale, Readonly<Record<EmailTemplate, string>>>
> = {
  'de-CH': {
    'verify-email': `Willkommen bei ${BRAND_NAME}! Bitte bestätige deine E-Mail-Adresse`,
    'account-exists': `Du hast bereits ein Konto bei ${BRAND_NAME}`,
    'password-reset': `Neues Passwort für ${BRAND_NAME}`,
    'password-changed': `Dein ${BRAND_NAME}-Passwort wurde geändert`,
    'email-change': `Bitte bestätige deine neue E-Mail-Adresse für ${BRAND_NAME}`,
    invite: `Du bist zu ${BRAND_NAME} eingeladen`,
    'email-changed': `Deine E-Mail-Adresse bei ${BRAND_NAME} wurde geändert`,
  },
  'en-US': {
    'verify-email': `Welcome to ${BRAND_NAME}! Please confirm your email address`,
    'account-exists': `You already have a ${BRAND_NAME} account`,
    'password-reset': `Reset your ${BRAND_NAME} password`,
    'password-changed': `Your ${BRAND_NAME} password was changed`,
    'email-change': `Please confirm your new email address for ${BRAND_NAME}`,
    invite: `You're invited to ${BRAND_NAME}`,
    'email-changed': `Your ${BRAND_NAME} email address was changed`,
  },
};
