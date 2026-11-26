import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { errorMessage } from '../../common/errors/error-message';
import type { VersionedCipher } from '../../common/crypto/versioned-cipher';
import type { Env } from '../../config/env.schema';
import { createEmailCipher, openJob } from './email-cipher';
import { MailerService } from './mailer.service';
import { EMAIL_QUEUE, type EmailJob } from './email.types';
import { TemplateRenderer } from './template-renderer';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly cipher: VersionedCipher;

  constructor(
    private readonly renderer: TemplateRenderer,
    private readonly mailer: MailerService,
    config: ConfigService<Env, true>,
  ) {
    super();
    this.cipher = createEmailCipher(
      config.get('ENCRYPTION_KEY', { infer: true }),
    );
  }

  async process(job: Job<EmailJob>): Promise<void> {
    try {
      const message = openJob(this.cipher, job.data);
      await this.mailer.send(message.to, this.renderer.render(message));
      this.logger.log(`Sent ${job.data.template} email (job ${job.id})`);
    } catch (error) {
      this.logger.warn(
        `Sending ${job.data.template} email failed (job ${job.id}, attempt ${job.attemptsMade + 1}): ${errorMessage(error)}`,
      );
      throw error;
    }
  }
}
