import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { createTransport } from 'nodemailer';
import { buildTransportOptions, isEmailConfigured } from './email.config';
import { EmailModule } from './email.module';
import { EmailProcessor } from './email.processor';
import { EMAIL_JOB_OPTIONS, EmailService } from './email.service';
import { createEmailCipher, openJob, sealMessage } from './email-cipher';
import type { EmailJob, EmailMessage } from './email.types';
import { MailerService } from './mailer.service';
import type { TemplateRenderer } from './template-renderer';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const ENCRYPTION_KEY = 'enc-Key-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ-xyz';

const message: EmailMessage = {
  template: 'verify-email',
  to: 'parent@example.com',
  locale: 'de-CH',
  context: { link: 'https://x/verify-email?token=secret-token' },
};

const keyConfig = {
  get: () => ENCRYPTION_KEY,
} as unknown as ConfigService<never, true>;

const smtpEnv = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_USER: 'user',
  SMTP_PASSWORD: 'pass',
  SMTP_FROM: 'Murmeli <no-reply@example.com>',
  APP_URL: 'https://murmeli.example.com',
};

describe('email config', () => {
  it('is enabled only with a non-blank SMTP_HOST', () => {
    expect(isEmailConfigured({ SMTP_HOST: 'mail' })).toBe(true);
    expect(isEmailConfigured({ SMTP_HOST: '  ' })).toBe(false);
    expect(isEmailConfigured({})).toBe(false);
  });

  it('builds transport options with auth and timeouts', () => {
    expect(buildTransportOptions(smtpEnv)).toEqual({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
  });

  it('omits auth without full credentials', () => {
    const options = buildTransportOptions({
      ...smtpEnv,
      SMTP_HOST: undefined,
      SMTP_PASSWORD: undefined,
    });

    expect(options).not.toHaveProperty('auth');
    expect(options.host).toBe('');
  });
});

describe('email cipher', () => {
  const cipher = createEmailCipher(ENCRYPTION_KEY);

  it('seals the context so no token is readable in the job', () => {
    const sealed = sealMessage(cipher, message);

    expect(sealed).toMatchObject({
      template: 'verify-email',
      to: 'parent@example.com',
      locale: 'de-CH',
    });
    expect(JSON.stringify(sealed)).not.toContain('secret-token');
    expect(openJob(cipher, sealed)).toEqual(message);
  });

  it('binds the context to template and recipient', () => {
    const sealed = sealMessage(cipher, message);

    expect(() =>
      openJob(cipher, { ...sealed, to: 'attacker@example.com' }),
    ).toThrow();
    expect(() => openJob(cipher, { ...sealed, template: 'invite' })).toThrow();
  });

  it('cannot be opened with another key', () => {
    const sealed = sealMessage(cipher, message);
    const other = createEmailCipher(
      'other-Key-0123456789-abcdefghijklmnopqrst',
    );

    expect(() => openJob(other, sealed)).toThrow();
  });
});

describe('EmailService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports disabled without a queue', async () => {
    const service = new EmailService(keyConfig);

    expect(service.enabled).toBe(false);
    await expect(service.send(message)).resolves.toBe('disabled');
  });

  it('queues sealed jobs with retries and short failure retention', async () => {
    const add = jest.fn().mockResolvedValue({});
    const service = new EmailService(keyConfig, { add });

    expect(service.enabled).toBe(true);
    await expect(service.send(message)).resolves.toBe('queued');
    const [name, queued, options] = add.mock.calls[0] as [
      string,
      EmailJob,
      typeof EMAIL_JOB_OPTIONS,
    ];
    expect(name).toBe('verify-email');
    expect(queued).not.toHaveProperty('context');
    expect(openJob(createEmailCipher(ENCRYPTION_KEY), queued)).toEqual(message);
    expect(options).toBe(EMAIL_JOB_OPTIONS);
    expect(EMAIL_JOB_OPTIONS.attempts).toBeGreaterThan(1);
    expect(EMAIL_JOB_OPTIONS.removeOnFail).toEqual({ age: 3600 });
  });

  it('reports failed when queueing fails', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const service = new EmailService(keyConfig, {
      add: jest.fn().mockRejectedValue(new Error('redis down')),
    });

    await expect(service.send(message)).resolves.toBe('failed');
  });
});

describe('MailerService', () => {
  it('sends through the SMTP transport and closes it', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const close = jest.fn();
    (createTransport as jest.Mock).mockReturnValue({ sendMail, close });
    const config = {
      get: (key: keyof typeof smtpEnv) => smtpEnv[key],
    } as unknown as ConfigService;

    const mailer = new MailerService(config as never);
    await mailer.send('to@example.com', {
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
    mailer.onModuleDestroy();

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.com', port: 587 }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Murmeli <no-reply@example.com>',
      to: 'to@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
    expect(close).toHaveBeenCalled();
  });
});

describe('EmailProcessor', () => {
  const rendered = { subject: 's', html: 'h', text: 't' };
  const renderer = { render: jest.fn().mockReturnValue(rendered) };
  const queuedJob = {
    id: '7',
    data: sealMessage(createEmailCipher(ENCRYPTION_KEY), message),
    attemptsMade: 0,
  } as Job<EmailJob>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('renders and sends the job', async () => {
    const mailer = { send: jest.fn().mockResolvedValue(undefined) };
    const processor = new EmailProcessor(
      renderer as unknown as TemplateRenderer,
      mailer as unknown as MailerService,
      keyConfig,
    );

    await processor.process(queuedJob);

    expect(renderer.render).toHaveBeenCalledWith(message);
    expect(mailer.send).toHaveBeenCalledWith('parent@example.com', rendered);
  });

  it('rethrows so BullMQ retries', async () => {
    const mailer = {
      send: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
    };
    const processor = new EmailProcessor(
      renderer as unknown as TemplateRenderer,
      mailer as unknown as MailerService,
      keyConfig,
    );

    await expect(processor.process(queuedJob)).rejects.toThrow('ETIMEDOUT');
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('attempt 1'),
    );
  });
});

describe('EmailModule.register', () => {
  it('only provides the service when email is disabled', () => {
    const module = EmailModule.register(false);

    expect(module.global).toBe(true);
    expect(module.providers).toEqual([EmailService]);
    expect(module.imports).toBeUndefined();
  });

  it('adds the queue, renderer, mailer and worker when enabled', () => {
    const module = EmailModule.register(true);

    expect(module.imports).toHaveLength(1);
    expect(module.providers).toEqual(
      expect.arrayContaining([EmailService, MailerService, EmailProcessor]),
    );
    expect(module.exports).toEqual([EmailService]);
  });
});
