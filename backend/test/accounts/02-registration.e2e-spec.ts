import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  type Agent,
  newClient,
  uniqueEmail,
  withoutRequestId,
} from '../support/client';
import { appUrl, createE2eApp, describeWithMail } from '../support/e2e-app';
import {
  PASSWORD,
  adminClient,
  altchaPayload,
  login,
  restoreSettings,
  setRegistration,
} from '../support/flows';
import { mailCount, tokenFrom, waitForMail } from '../support/mailpit';

describeWithMail('Registration and recovery (e2e, Mailpit)', () => {
  let app: NestExpressApplication;
  let admin: Agent;

  beforeAll(async () => {
    app = await createE2eApp();
    admin = await adminClient(app);
    await setRegistration(admin, true);
  });

  afterAll(async () => {
    await restoreSettings(app);
    await app.close();
  });

  async function register(email: string, locale = 'de-CH') {
    const client = newClient(app);
    return client.post('/api/auth/register').send({
      email,
      password: PASSWORD,
      locale,
      acceptTerms: true,
      altcha: await altchaPayload(client),
    });
  }

  it('registers, verifies by email and signs in', async () => {
    const email = uniqueEmail('new');
    const response = await register(email);
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ ok: true });

    await newClient(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(403)
      .expect(({ body }) => expect(body.errorCode).toBe('EMAIL_NOT_VERIFIED'));

    const mail = await waitForMail(email, /bestätige/);
    expect(mail.Text).toContain(`${appUrl()}/verify-email?token=`);
    expect(mail.HTML).toContain(`${appUrl()}/brand/murmeli-mark.png`);
    expect(mail.Text).not.toContain('ß');
    const token = tokenFrom(mail, 'verify-email');

    await newClient(app)
      .post('/api/auth/verify-email')
      .send({ token })
      .expect(200, { ok: true, type: 'registration' });
    await newClient(app)
      .post('/api/auth/verify-email')
      .send({ token })
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('TOKEN_INVALID'));

    await login(newClient(app), email, PASSWORD);
  });

  it('answers an existing address the same way and mails a notice', async () => {
    const email = uniqueEmail('twice');
    const first = await register(email, 'en-US');
    await waitForMail(email, /confirm/i);
    const second = await register(email, 'en-US');

    expect(second.status).toBe(first.status);
    expect(withoutRequestId(second.body)).toEqual(withoutRequestId(first.body));
    const notice = await waitForMail(email, /already have/);
    expect(notice.Text).toContain(`${appUrl()}/forgot-password`);
  });

  it('rejects a missing, forged or reused ALTCHA payload', async () => {
    const client = newClient(app);
    const altcha = await altchaPayload(client);
    const body = {
      email: uniqueEmail(),
      password: PASSWORD,
      locale: 'de-CH',
      acceptTerms: true,
    };

    await client
      .post('/api/auth/register')
      .send({ ...body, altcha })
      .expect(202);
    for (const payload of [altcha, Buffer.from('{}').toString('base64')]) {
      await newClient(app)
        .post('/api/auth/register')
        .send({ ...body, email: uniqueEmail(), altcha: payload })
        .expect(400)
        .expect(({ body: error }) =>
          expect(error.errorCode).toBe('ALTCHA_INVALID'),
        );
    }
    await newClient(app)
      .post('/api/auth/register')
      .send({ ...body, acceptTerms: false, altcha })
      .expect(400)
      .expect(({ body: error }) =>
        expect(error.errorCode).toBe('VALIDATION_FAILED'),
      );
  });

  it('resends the verification email', async () => {
    const email = uniqueEmail('resend');
    await register(email);
    await waitForMail(email, /bestätige/);
    const client = newClient(app);
    await client
      .post('/api/auth/resend-verification')
      .send({ email, altcha: await altchaPayload(client) })
      .expect(202, { ok: true });
    const mail = await waitForMail(email, /bestätige/, 2);

    await newClient(app)
      .post('/api/auth/verify-email')
      .send({ token: tokenFrom(mail, 'verify-email') })
      .expect(200);
  });

  it('resets a forgotten password and signs out every session', async () => {
    const email = uniqueEmail('forgot');
    await register(email, 'en-US');
    const verify = await waitForMail(email, /confirm/i);
    await newClient(app)
      .post('/api/auth/verify-email')
      .send({ token: tokenFrom(verify, 'verify-email') })
      .expect(200);
    const session = newClient(app);
    await login(session, email, PASSWORD);

    const client = newClient(app);
    await client
      .post('/api/auth/forgot-password')
      .send({ email, altcha: await altchaPayload(client) })
      .expect(202, { ok: true });
    const mail = await waitForMail(email, /Reset your/);
    const token = tokenFrom(mail, 'reset-password');

    await newClient(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'brand-New-Password-1' })
      .expect(200, { ok: true });
    await session.get('/api/auth/me').expect(401);
    await login(newClient(app), email, 'brand-New-Password-1');
    await waitForMail(email, /was changed/);
  });

  it('answers forgot-password for unknown addresses without sending mail', async () => {
    const email = uniqueEmail('ghost');
    const client = newClient(app);
    await client
      .post('/api/auth/forgot-password')
      .send({ email, altcha: await altchaPayload(client) })
      .expect(202, { ok: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await mailCount(email)).toBe(0);
  });

  it('sends at most three reset emails per address and hour', async () => {
    const email = uniqueEmail('flood');
    await register(email, 'en-US');
    const verify = await waitForMail(email, /confirm/i);
    await newClient(app)
      .post('/api/auth/verify-email')
      .send({ token: tokenFrom(verify, 'verify-email') })
      .expect(200);

    for (let request = 0; request < 4; request += 1) {
      const client = newClient(app);
      await client
        .post('/api/auth/forgot-password')
        .send({ email, altcha: await altchaPayload(client) })
        .expect(202, { ok: true });
    }
    await waitForMail(email, /Reset your/, 3);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await mailCount(email)).toBe(4);
  });

  it('refuses registration while it is disabled', async () => {
    await setRegistration(admin, false);
    try {
      const response = await register(uniqueEmail());
      expect(response.status).toBe(403);
      expect(response.body.errorCode).toBe('REGISTRATION_DISABLED');
      await newClient(app)
        .get('/api/auth/config')
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            registrationEnabled: false,
            emailEnabled: true,
          }),
        );
    } finally {
      await setRegistration(admin, true);
    }
  });
});
