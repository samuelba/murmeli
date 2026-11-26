import {
  VersionedCipher,
  deriveEncryptionKey,
} from '../../common/crypto/versioned-cipher';
import type { EmailContext, EmailJob, EmailMessage } from './email.types';

const KEY_VERSION = 'v1';

export function createEmailCipher(encryptionKey: string): VersionedCipher {
  return new VersionedCipher({
    current: KEY_VERSION,
    keys: { [KEY_VERSION]: deriveEncryptionKey(encryptionKey, 'email-job') },
  });
}

function aadOf(message: Pick<EmailMessage, 'template' | 'to'>): string {
  return `${message.template}|${message.to}`;
}

export function sealMessage(
  cipher: VersionedCipher,
  message: EmailMessage,
): EmailJob {
  return {
    template: message.template,
    to: message.to,
    locale: message.locale,
    sealedContext: cipher.encrypt(
      JSON.stringify(message.context),
      aadOf(message),
    ),
  };
}

export function openJob(cipher: VersionedCipher, job: EmailJob): EmailMessage {
  const context = JSON.parse(
    cipher.decrypt(job.sealedContext, aadOf(job)),
  ) as EmailContext;
  return { template: job.template, to: job.to, locale: job.locale, context };
}
