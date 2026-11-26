import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '../../config/brand';
import type { Env } from '../../config/env.schema';
import { EMAIL_SUBJECTS } from './email-subjects';
import {
  EMAIL_LOGO_PATH,
  type EmailMessage,
  type EmailTemplate,
  type RenderedEmail,
} from './email.types';
import type { Locale } from '../users/user.types';

export const TEMPLATES_DIR = join(__dirname, 'templates');

type Compiled = HandlebarsTemplateDelegate<Record<string, unknown>>;

function readTemplate(dir: string, path: string): string {
  return readFileSync(join(dir, path), 'utf8');
}

/**
 * Renders the Handlebars email templates (`templates/<locale>/<name>.html.hbs`
 * and `.txt.hbs`). HTML values are escaped; text templates are not.
 */
@Injectable()
export class TemplateRenderer {
  private readonly handlebars = Handlebars.create();
  private readonly cache = new Map<string, Compiled>();
  private readonly appUrl: string;

  protected readonly dir: string = TEMPLATES_DIR;

  constructor(config: ConfigService<Env, true>) {
    this.appUrl = config.get('APP_URL', { infer: true });
    this.handlebars.registerPartial(
      'layout',
      readTemplate(this.dir, 'partials/layout.html.hbs'),
    );
  }

  render(job: EmailMessage): RenderedEmail {
    const subject = EMAIL_SUBJECTS[job.locale][job.template];
    const context = {
      ...job.context,
      subject,
      brandName: BRAND_NAME,
      appUrl: this.appUrl,
      logoUrl: `${this.appUrl}${EMAIL_LOGO_PATH}`,
      lang: job.locale,
      year: new Date().getUTCFullYear(),
    };
    return {
      subject,
      html: this.compiled(job.locale, job.template, 'html')(context),
      text: this.compiled(job.locale, job.template, 'txt')(context),
    };
  }

  private compiled(
    locale: Locale,
    template: EmailTemplate,
    format: 'html' | 'txt',
  ): Compiled {
    const path = `${locale}/${template}.${format}.hbs`;
    const cached = this.cache.get(path);
    if (cached) {
      return cached;
    }
    const compiled = this.handlebars.compile<Record<string, unknown>>(
      readTemplate(this.dir, path),
      { strict: true, noEscape: format === 'txt' },
    );
    this.cache.set(path, compiled);
    return compiled;
  }
}
