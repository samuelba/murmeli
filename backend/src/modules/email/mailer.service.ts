import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { pickEnv } from '../../config/app-config';
import type { Env } from '../../config/env.schema';
import { SMTP_ENV_KEYS, buildTransportOptions } from './email.config';
import type { RenderedEmail } from './email.types';

@Injectable()
export class MailerService implements OnModuleDestroy {
  private readonly transporter: Pick<Transporter, 'sendMail' | 'close'>;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const env = pickEnv(config, SMTP_ENV_KEYS);
    this.transporter = createTransport(buildTransportOptions(env));
    this.from = env.SMTP_FROM ?? '';
  }

  async send(to: string, email: RenderedEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
