import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module } from '@nestjs/common';
import { isEmailConfigured } from './email.config';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';
import { EMAIL_QUEUE } from './email.types';
import { MailerService } from './mailer.service';
import { TemplateRenderer } from './template-renderer';

@Module({})
export class EmailModule {
  static register(enabled: boolean = isEmailConfigured()): DynamicModule {
    const base: DynamicModule = {
      module: EmailModule,
      global: true,
      providers: [EmailService],
      exports: [EmailService],
    };
    if (!enabled) {
      return base;
    }
    return {
      ...base,
      imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
      providers: [
        EmailService,
        TemplateRenderer,
        MailerService,
        EmailProcessor,
      ],
    };
  }
}
