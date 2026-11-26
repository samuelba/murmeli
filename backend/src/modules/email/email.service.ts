import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JobsOptions, Queue } from 'bullmq';
import { errorMessage } from '../../common/errors/error-message';
import type { VersionedCipher } from '../../common/crypto/versioned-cipher';
import type { Env } from '../../config/env.schema';
import { createEmailCipher, sealMessage } from './email-cipher';
import {
  EMAIL_QUEUE,
  type EmailJob,
  type EmailMessage,
  type EmailStatus,
} from './email.types';

export const EMAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 6,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: { age: 3600 },
};

export type SendResult = EmailStatus | 'failed';

/**
 * Queues emails for the worker. Without SMTP configuration the queue is not
 * registered and every send reports `disabled`.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly cipher: VersionedCipher;

  constructor(
    config: ConfigService<Env, true>,
    @Optional()
    @InjectQueue(EMAIL_QUEUE)
    private readonly queue?: Pick<Queue<EmailJob>, 'add'>,
  ) {
    this.cipher = createEmailCipher(
      config.get('ENCRYPTION_KEY', { infer: true }),
    );
  }

  get enabled(): boolean {
    return this.queue !== undefined;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    if (!this.queue) {
      return 'disabled';
    }
    const job = sealMessage(this.cipher, message);
    try {
      await this.queue.add(job.template, job, EMAIL_JOB_OPTIONS);
      return 'queued';
    } catch (error) {
      this.logger.error(
        `Could not queue ${job.template} email: ${errorMessage(error)}`,
      );
      return 'failed';
    }
  }
}
