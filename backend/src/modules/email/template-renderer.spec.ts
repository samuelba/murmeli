import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { LOCALES } from '../users/user.types';
import { EMAIL_SUBJECTS } from './email-subjects';
import { EMAIL_TEMPLATES, type EmailTemplate } from './email.types';
import { TemplateRenderer } from './template-renderer';

const APP_URL = 'https://murmeli.example.com';
const config = {
  get: () => APP_URL,
} as unknown as ConfigService<Env, true>;

const CONTEXTS: Record<EmailTemplate, Record<string, string>> = {
  'verify-email': { link: `${APP_URL}/verify-email?token=tok-verify` },
  'account-exists': {
    loginUrl: `${APP_URL}/login`,
    resetUrl: `${APP_URL}/forgot-password`,
  },
  'password-reset': { link: `${APP_URL}/reset-password?token=tok-reset` },
  'password-changed': { resetUrl: `${APP_URL}/forgot-password` },
  'email-change': {
    link: `${APP_URL}/verify-email?token=tok-change`,
    newEmail: 'neu@example.com',
  },
  invite: { link: `${APP_URL}/invite/tok-invite` },
  'email-changed': { loginUrl: `${APP_URL}/login` },
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/=/g, '&#x3D;');
}

const cases = LOCALES.flatMap((locale) =>
  EMAIL_TEMPLATES.map((template) => [locale, template] as const),
);

describe('TemplateRenderer', () => {
  const renderer = new TemplateRenderer(config);

  it.each(cases)(
    'renders %s %s with brand, logo and links',
    (locale, template) => {
      const context = CONTEXTS[template];
      const email = renderer.render({
        template,
        locale,
        to: 'parent@example.com',
        context,
      });

      expect(email.subject).toBe(EMAIL_SUBJECTS[locale][template]);
      expect(email.subject).toContain('Murmeli');
      expect(email.html).toContain(`src="${APP_URL}/brand/murmeli-mark.png"`);
      expect(email.html).toContain(`<html lang="${locale}">`);
      expect(email.text).toContain('Murmeli');
      for (const value of Object.values(context)) {
        expect(email.text).toContain(value);
        expect(email.html).toContain(escapeHtml(value));
      }
      expect(email.html).not.toMatch(/\{\{|\}\}/);
      expect(email.text).not.toMatch(/\{\{|\}\}/);
    },
  );

  it.each(EMAIL_TEMPLATES)('writes de-CH %s without ß', (template) => {
    const email = renderer.render({
      template,
      locale: 'de-CH',
      to: 'parent@example.com',
      context: CONTEXTS[template],
    });

    expect(`${email.subject}${email.html}${email.text}`).not.toContain('ß');
  });

  it('escapes values in HTML but not in text', () => {
    const email = renderer.render({
      template: 'email-change',
      locale: 'en-US',
      to: 'x@example.com',
      context: {
        link: `${APP_URL}/verify-email?token=a&b`,
        newEmail: '<b>x</b>',
      },
    });

    expect(email.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(email.html).not.toContain('<b>x</b>');
    expect(email.text).toContain('<b>x</b>');
  });

  it('fails loudly when a template variable is missing', () => {
    expect(() =>
      renderer.render({
        template: 'verify-email',
        locale: 'en-US',
        to: 'x@example.com',
        context: {},
      }),
    ).toThrow();
  });

  it('caches compiled templates', () => {
    const job = {
      template: 'invite' as const,
      locale: 'de-CH' as const,
      to: 'x@example.com',
      context: CONTEXTS.invite,
    };

    expect(renderer.render(job)).toEqual(renderer.render(job));
  });
});
