import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { type Agent, newClient, uniqueEmail } from '../support/client';
import { appUrl, createE2eApp, describeWithDb } from '../support/e2e-app';
import { PASSWORD, adminClient, login, parentClient } from '../support/flows';
import { tokenFrom, waitForMail } from '../support/mailpit';

const NEW_PASSWORD = 'reset-by-Admin-0123';
interface ResetLink {
  readonly resetUrl: string;
  readonly expiresAt: string;
}

const UNKNOWN_ID = '01a218d7-5edc-7a87-a1d4-5fe46ddc0000';

describeWithDb('Admin account recovery (e2e)', () => {
  let app: NestExpressApplication;
  let admin: Agent;

  beforeAll(async () => {
    app = await createE2eApp();
    admin = await adminClient(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function userId(email: string): Promise<string> {
    const response = await admin
      .get('/api/admin/users')
      .query({ search: email })
      .expect(200);
    return response.body.items[0].id as string;
  }

  function resetLink(id: string) {
    return admin.post(`/api/admin/users/${id}/password-reset-link`);
  }

  function tokenOf(resetUrl: string): string {
    return new URL(resetUrl).searchParams.get('token') ?? '';
  }

  it('hands out a single-use reset link that replaces older ones', async () => {
    const email = uniqueEmail('reset-link');
    await parentClient(app, email);
    const id = await userId(email);

    const first = (await resetLink(id).expect(201)).body as ResetLink;
    const second = (await resetLink(id).expect(201)).body as ResetLink;
    expect(Object.keys(second).sort()).toEqual(['expiresAt', 'resetUrl']);
    expect(second.resetUrl).toMatch(
      new RegExp(`^${appUrl()}/reset-password\\?token=[\\w-]{43}$`),
    );
    const expiresIn = Date.parse(second.expiresAt) - Date.now();
    expect(expiresIn).toBeGreaterThan(55 * 60_000);
    expect(expiresIn).toBeLessThanOrEqual(3600_000);

    const anonymous = newClient(app);
    await anonymous
      .post('/api/auth/reset-password')
      .send({ token: tokenOf(first.resetUrl), password: NEW_PASSWORD })
      .expect(400);
    await anonymous
      .post('/api/auth/reset-password')
      .send({ token: tokenOf(second.resetUrl), password: NEW_PASSWORD })
      .expect(200);
    await anonymous
      .post('/api/auth/reset-password')
      .send({ token: tokenOf(second.resetUrl), password: NEW_PASSWORD })
      .expect(400);
    await login(newClient(app), email, NEW_PASSWORD);

    const log = await admin
      .get('/api/admin/audit-log')
      .query({ action: 'admin.password_reset_link_created', pageSize: 2 })
      .expect(200);
    expect(log.body.items[0]).toMatchObject({
      targetType: 'user',
      targetId: id,
    });
    expect(JSON.stringify(log.body)).not.toContain(tokenOf(second.resetUrl));
  });

  it('refuses unknown and disabled users and parents', async () => {
    await resetLink(UNKNOWN_ID)
      .expect(404)
      .expect(({ body }) => expect(body.errorCode).toBe('USER_NOT_FOUND'));
    await resetLink('nope').expect(400);

    const email = uniqueEmail('reset-disabled');
    const parent = await parentClient(app, email);
    const id = await userId(email);
    await parent.post(`/api/admin/users/${id}/password-reset-link`).expect(403);
    await parent.post(`/api/admin/users/${id}/verify-email`).expect(403);
    await admin
      .patch(`/api/admin/users/${id}`)
      .send({ disabled: true })
      .expect(200);
    await resetLink(id)
      .expect(409)
      .expect(({ body }) => expect(body.errorCode).toBe('USER_DISABLED'));
  });

  it('marks an address verified, idempotently and audited once', async () => {
    const email = uniqueEmail('verify-by-admin');
    await parentClient(app, email);
    const id = await userId(email);
    await app
      .get(DataSource)
      .query(`UPDATE "users" SET "email_verified_at" = NULL WHERE "id" = $1`, [
        id,
      ]);
    await newClient(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(403);
    await admin.post(`/api/admin/users/${id}/resend-verification`).expect(202);

    for (let i = 0; i < 2; i += 1) {
      await admin
        .post(`/api/admin/users/${id}/verify-email`)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({ id, email, emailVerified: true }),
        );
    }
    await admin.post(`/api/admin/users/${UNKNOWN_ID}/verify-email`).expect(404);
    await login(newClient(app), email, PASSWORD);

    const log = await admin
      .get('/api/admin/audit-log')
      .query({ action: 'admin.email_verified', pageSize: 100 })
      .expect(200);
    expect(
      (log.body.items as { targetId: string }[]).filter(
        (entry) => entry.targetId === id,
      ),
    ).toHaveLength(1);

    if (process.env.MAILPIT_URL) {
      const mail = await waitForMail(email, /Bitte bestätige deine E-Mail/);
      await newClient(app)
        .post('/api/auth/verify-email')
        .send({ token: tokenFrom(mail, 'verify-email') })
        .expect(400);
    }
  });
});
