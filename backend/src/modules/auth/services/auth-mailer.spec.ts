import { sha256Hex } from '../../../common/crypto/secure-token';
import type { EmailMessage } from '../../email/email.types';
import { AuthMailer } from './auth-mailer';

const APP_URL = 'https://murmeli.example.com';
const to = { email: 'parent@example.com', locale: 'de-CH' as const };

const POLICIES = { mailRecipient: { name: 'mail-recipient' } };

function setup(enabled = true, allowed = true) {
  const email = { enabled, send: jest.fn().mockResolvedValue('queued') };
  const limiter = {
    attempt: jest
      .fn()
      .mockResolvedValue({ allowed, retryAfterSeconds: 0, justLocked: false }),
  };
  const config = { get: jest.fn().mockReturnValue(APP_URL) };
  const mailer = new AuthMailer(
    email as never,
    limiter as never,
    POLICIES as never,
    config as never,
  );
  return { mailer, email, limiter };
}

function sent(email: { send: jest.Mock }): EmailMessage {
  return email.send.mock.calls[0][0] as EmailMessage;
}

describe('AuthMailer', () => {
  it('reports whether email is enabled', () => {
    expect(setup(true).mailer.enabled).toBe(true);
    expect(setup(false).mailer.enabled).toBe(false);
  });

  it('links verification to /verify-email', async () => {
    const { mailer, email } = setup();

    await expect(mailer.verifyEmail(to, 'a/b+c')).resolves.toBe('queued');

    expect(sent(email)).toEqual({
      template: 'verify-email',
      to: 'parent@example.com',
      locale: 'de-CH',
      context: { link: `${APP_URL}/verify-email?token=a%2Fb%2Bc` },
    });
  });

  it('links a reset to /reset-password', async () => {
    const { mailer, email } = setup();

    await mailer.passwordReset(to, 'tok');

    expect(sent(email)).toMatchObject({
      template: 'password-reset',
      context: { link: `${APP_URL}/reset-password?token=tok` },
    });
    expect(mailer.passwordResetUrl('a/b')).toBe(
      `${APP_URL}/reset-password?token=a%2Fb`,
    );
  });

  it('points "account exists" to sign-in and forgot-password', async () => {
    const { mailer, email } = setup();

    await mailer.accountExists(to);

    expect(sent(email).context).toEqual({
      loginUrl: `${APP_URL}/login`,
      resetUrl: `${APP_URL}/forgot-password`,
    });
  });

  it('offers a reset in the password-changed notice', async () => {
    const { mailer, email } = setup();

    await mailer.passwordChanged(to);

    expect(sent(email)).toMatchObject({
      template: 'password-changed',
      context: { resetUrl: `${APP_URL}/forgot-password` },
    });
  });

  it('sends the email-change link to the new address', async () => {
    const { mailer, email } = setup();

    await mailer.emailChange(
      { email: 'next@example.com', locale: 'en-US' },
      'tok',
    );

    expect(sent(email)).toEqual({
      template: 'email-change',
      to: 'next@example.com',
      locale: 'en-US',
      context: {
        link: `${APP_URL}/verify-email?token=tok`,
        newEmail: 'next@example.com',
      },
    });
  });

  it('links invites to /invite/<token>', async () => {
    const { mailer, email } = setup();

    await mailer.invite(to, 'tok');

    expect(mailer.inviteUrl('tok')).toBe(`${APP_URL}/invite/tok`);
    expect(sent(email)).toMatchObject({
      template: 'invite',
      context: { link: `${APP_URL}/invite/tok` },
    });
  });

  it('returns disabled without touching the limiter when email is off', async () => {
    const { mailer, email, limiter } = setup(false);

    await expect(mailer.verifyEmail(to, 'tok')).resolves.toBe('disabled');
    expect(limiter.attempt).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it.each([
    ['verify-email', 'verify'],
    ['account-exists', 'verify'],
    ['password-reset', 'reset'],
    ['email-change', 'email-change'],
  ])('limits %s emails per recipient as %s', async (template, kind) => {
    const { mailer, limiter } = setup();
    const send: Record<string, () => Promise<unknown>> = {
      'verify-email': () => mailer.verifyEmail(to, 't'),
      'account-exists': () => mailer.accountExists(to),
      'password-reset': () => mailer.passwordReset(to, 't'),
      'email-change': () => mailer.emailChange(to, 't'),
    };

    await send[template]();

    expect(limiter.attempt).toHaveBeenCalledWith(
      POLICIES.mailRecipient,
      `${sha256Hex('parent@example.com')}:${kind}`,
    );
  });

  it('keys the recipient limit case-insensitively', async () => {
    const { mailer, limiter } = setup();

    await mailer.passwordReset(
      { email: ' Parent@Example.com ', locale: 'de-CH' },
      't',
    );

    expect(limiter.attempt.mock.calls[0][1]).toBe(
      `${sha256Hex('parent@example.com')}:reset`,
    );
  });

  it('silently drops a limited email over the cap', async () => {
    const { mailer, email } = setup(true, false);

    await expect(mailer.passwordReset(to, 'tok')).resolves.toBe('dropped');
    expect(email.send).not.toHaveBeenCalled();
  });

  it('never limits notices and invites', async () => {
    const { mailer, email, limiter } = setup(true, false);

    await mailer.passwordChanged(to);
    await mailer.emailChanged(to);
    await mailer.invite(to, 'tok');

    expect(limiter.attempt).not.toHaveBeenCalled();
    expect(email.send).toHaveBeenCalledTimes(3);
  });

  it('tells the old address about an email change', async () => {
    const { mailer, email } = setup();

    await mailer.emailChanged(to);

    expect(sent(email)).toEqual({
      template: 'email-changed',
      to: 'parent@example.com',
      locale: 'de-CH',
      context: { loginUrl: `${APP_URL}/login` },
    });
  });
});
