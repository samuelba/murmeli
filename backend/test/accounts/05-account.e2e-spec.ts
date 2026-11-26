import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { cookieValue, newClient, uniqueEmail } from '../support/client';
import { createE2eApp, describeWithDb } from '../support/e2e-app';
import { PASSWORD, adminClient, login, parentClient } from '../support/flows';
import { tokenFrom, waitForMail } from '../support/mailpit';

const KID = {
  nickname: 'Mia',
  avatar: { animal: 'fox', accessory: null, background: '#FFD8A8' },
  startClass: '1',
  language: 'en-US',
  pin: [1, 1, 2, 2],
};

const itWithMail = process.env.MAILPIT_URL ? it : it.skip;

describeWithDb('Account (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(() => app.close());

  it('changes the password and signs out the other sessions', async () => {
    const email = uniqueEmail('pw');
    const current = await parentClient(app, email);
    const other = newClient(app);
    await login(other, email, PASSWORD);

    await current
      .post('/api/account/password')
      .send({
        currentPassword: 'wrong-Password-1',
        newPassword: 'next-Password-123',
      })
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('INVALID_CREDENTIALS'));
    await current
      .post('/api/account/password')
      .send({ currentPassword: PASSWORD, newPassword: 'short' })
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('VALIDATION_FAILED'));
    await current
      .post('/api/account/password')
      .send({ currentPassword: PASSWORD, newPassword: 'next-Password-123' })
      .expect(200);

    await current.get('/api/auth/me').expect(200);
    await other.get('/api/auth/me').expect(401);
    await login(newClient(app), email, 'next-Password-123');
  });

  itWithMail(
    'changes the email address after confirming the new one',
    async () => {
      const email = uniqueEmail('old');
      const newEmail = uniqueEmail('new');
      const parent = await parentClient(app, email);

      await parent
        .post('/api/account/email')
        .send({ newEmail, password: PASSWORD })
        .expect(202, { ok: true });
      const mail = await waitForMail(newEmail, /neue E-Mail-Adresse/);
      expect(mail.Text).toContain(newEmail);

      await newClient(app)
        .post('/api/auth/verify-email')
        .send({ token: tokenFrom(mail, 'verify-email') })
        .expect(200, { ok: true, type: 'email_change' });
      await parent
        .get('/api/auth/me')
        .expect(({ body }) => expect(body.user.email).toBe(newEmail));
      const notice = await waitForMail(email, /wurde geändert/);
      expect(notice.Text).not.toContain(newEmail);
      await login(newClient(app), newEmail, PASSWORD);
    },
  );

  it('updates the locale and theme', async () => {
    const parent = await parentClient(app, uniqueEmail('prefs'));
    const response = await parent
      .patch('/api/account')
      .send({ locale: 'en-US', theme: 'dark' })
      .expect(200);
    expect(response.body.user).toMatchObject({
      locale: 'en-US',
      theme: 'dark',
    });
    await parent.patch('/api/account').send({ theme: 'neon' }).expect(400);
  });

  it('exports the account data without secrets', async () => {
    const email = uniqueEmail('export');
    const parent = await parentClient(app, email);
    await parent.post('/api/kids').send(KID).expect(201);

    const response = await parent.get('/api/account/export').expect(200);
    expect(response.headers['content-disposition']).toMatch(/attachment/);
    expect(response.body).toMatchObject({
      user: { email },
      kids: [{ nickname: 'Mia', hasPin: true }],
      progress: [],
    });
    const text = JSON.stringify(response.body);
    expect(text).not.toMatch(/argon2|password|pinHash|token/i);
  });

  it('deletes the account with everything that belongs to it', async () => {
    const email = uniqueEmail('delete');
    const parent = await parentClient(app, email);
    const kid = await parent.post('/api/kids').send(KID).expect(201);
    const me = await parent.get('/api/auth/me').expect(200);
    const userId = me.body.user.id as string;

    await parent
      .delete('/api/account')
      .send({ password: 'wrong-Password-1' })
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('INVALID_CREDENTIALS'));
    const deleted = await parent
      .delete('/api/account')
      .send({ password: PASSWORD })
      .expect(204);
    expect(cookieValue(deleted, 'mu_at')).toBe('');

    const db = app.get(DataSource);
    const [counts] = await db.query<
      { kids: number; tokens: number; users: number }[]
    >(
      `SELECT
         (SELECT COUNT(*)::int FROM "kids" WHERE "id" = $1) AS "kids",
         (SELECT COUNT(*)::int FROM "refresh_tokens" WHERE "user_id" = $2) AS "tokens",
         (SELECT COUNT(*)::int FROM "users" WHERE "id" = $2) AS "users"`,
      [kid.body.id, userId],
    );
    expect(counts).toEqual({ kids: 0, tokens: 0, users: 0 });
    const [audit] = await db.query<{ count: number }[]>(
      `SELECT COUNT(*)::int AS "count" FROM "audit_log"
       WHERE "actor_id" = $1 OR "target_id" IN ($1::text, $2::text)`,
      [userId, kid.body.id],
    );
    expect(audit.count).toBe(0);
    const [entry] = await db.query<{ count: number }[]>(
      `SELECT COUNT(*)::int AS "count" FROM "audit_log"
       WHERE "action" = 'kid.created' AND "actor_id" IS NULL AND "ip" IS NULL AND "target_id" IS NULL`,
    );
    expect(entry.count).toBeGreaterThan(0);
    await newClient(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);
  });

  it('keeps the last admin', async () => {
    const admin = await adminClient(app);
    await admin
      .delete('/api/account')
      .send({ password: 'admin-Password-0123' })
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('LAST_ADMIN'));
  });
});
