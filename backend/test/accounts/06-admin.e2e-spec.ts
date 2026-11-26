import type { NestExpressApplication } from '@nestjs/platform-express';
import { type Agent, newClient, uniqueEmail } from '../support/client';
import { appUrl, createE2eApp, describeWithDb } from '../support/e2e-app';
import {
  ADMIN_EMAIL,
  PASSWORD,
  adminClient,
  login,
  parentClient,
  restoreSettings,
} from '../support/flows';
import { waitForMail } from '../support/mailpit';

describeWithDb('Admin (e2e)', () => {
  let app: NestExpressApplication;
  let admin: Agent;

  beforeAll(async () => {
    app = await createE2eApp();
    admin = await adminClient(app);
  });

  afterAll(async () => {
    await restoreSettings(app);
    await app.close();
  });

  async function userId(email: string): Promise<string> {
    const response = await admin
      .get('/api/admin/users')
      .query({ search: email })
      .expect(200);
    return response.body.items[0].id as string;
  }

  it('lists and searches users with kid counts', async () => {
    const email = uniqueEmail('Search_%');
    const parent = await parentClient(app, email);
    await parent
      .post('/api/kids')
      .send({
        nickname: 'Leo',
        avatar: { animal: 'owl', accessory: null, background: '#FFD8A8' },
        startClass: 'KG1',
        language: 'de-CH',
      })
      .expect(201);

    const page = await admin
      .get('/api/admin/users')
      .query({ search: 'search_%', page: 1, pageSize: 5 })
      .expect(200);
    expect(page.body).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(page.body.items[0]).toMatchObject({
      email,
      kidCount: 1,
      disabled: false,
    });
    expect(page.body.items[0].lastLoginAt).not.toBeNull();
    await admin.get('/api/admin/users').query({ pageSize: 101 }).expect(400);
  });

  it('keeps parents out', async () => {
    const parent = await parentClient(app, uniqueEmail('nosy'));
    await parent.get('/api/admin/stats').expect(403);
  });

  it('changes roles but always keeps an active admin', async () => {
    const adminId = await userId(ADMIN_EMAIL);
    await admin
      .patch(`/api/admin/users/${adminId}`)
      .send({ role: 'parent' })
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('LAST_ADMIN'));
    await admin
      .delete(`/api/admin/users/${adminId}`)
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('CANNOT_DELETE_SELF'));

    const email = uniqueEmail('promoted');
    await parentClient(app, email);
    const id = await userId(email);
    await admin
      .patch(`/api/admin/users/${id}`)
      .send({ role: 'admin' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ role: 'admin', kidCount: 0 }),
      );
    await admin.delete(`/api/admin/users/${id}`).expect(204);
    await admin.delete(`/api/admin/users/${id}`).expect(404);
  });

  it('disables a user and ends their sessions', async () => {
    const email = uniqueEmail('disabled');
    const parent = await parentClient(app, email);
    const id = await userId(email);
    await admin
      .patch(`/api/admin/users/${id}`)
      .send({ disabled: true })
      .expect(200)
      .expect(({ body }) => expect(body.disabled).toBe(true));
    await parent.get('/api/kids').expect(401);
    await parent.post('/api/auth/refresh').expect(401);
  });

  it('creates an invite that signs the new user in', async () => {
    const email = uniqueEmail('invited');
    const created = await admin
      .post('/api/admin/invites')
      .send({ email, role: 'admin' })
      .expect(201);
    expect(created.body.invite).toMatchObject({
      email,
      role: 'admin',
      createdBy: ADMIN_EMAIL,
    });
    expect(created.body.inviteUrl).toMatch(
      new RegExp(`^${appUrl()}/invite/[\\w-]+$`),
    );
    expect(['queued', 'disabled']).toContain(created.body.emailStatus);
    const token = (created.body.inviteUrl as string).split('/').pop() ?? '';

    if (process.env.MAILPIT_URL) {
      const mail = await waitForMail(email, /invited/);
      expect(mail.Text).toContain(created.body.inviteUrl);
    }
    await newClient(app)
      .get(`/api/invites/${token}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ email, role: 'admin' }),
      );
    const invited = newClient(app);
    const accepted = await invited
      .post(`/api/invites/${token}/accept`)
      .send({ password: PASSWORD, locale: 'en-US', acceptTerms: true })
      .expect(201);
    expect(accepted.body.user).toMatchObject({
      email,
      role: 'admin',
      emailVerified: true,
    });
    await invited.get('/api/admin/stats').expect(200);

    await newClient(app)
      .get(`/api/invites/${token}`)
      .expect(404)
      .expect(({ body }) => expect(body.errorCode).toBe('INVITE_INVALID'));
    await admin
      .post('/api/admin/invites')
      .send({ email, role: 'parent' })
      .expect(409);
  });

  it('lists and revokes invites', async () => {
    const email = uniqueEmail('revoked');
    const created = await admin
      .post('/api/admin/invites')
      .send({ email, role: 'parent' })
      .expect(201);
    const list = await admin.get('/api/admin/invites').expect(200);
    expect(
      (list.body.items as { email: string }[]).map((invite) => invite.email),
    ).toContain(email);

    await admin
      .delete(`/api/admin/invites/${created.body.invite.id}`)
      .expect(204);
    const token = (created.body.inviteUrl as string).split('/').pop() ?? '';
    await newClient(app).get(`/api/invites/${token}`).expect(404);
  });

  it('toggles settings and requires TOTP for admins when asked', async () => {
    const settings = await admin
      .patch('/api/admin/settings')
      .send({ registrationEnabled: true })
      .expect(200);
    expect(settings.body).toMatchObject({
      registrationEnabled: true,
      requireAdminTotp: false,
    });
    await newClient(app)
      .get('/api/auth/config')
      .expect(({ body }) => expect(body.registrationEnabled).toBe(true));

    await admin
      .patch('/api/admin/settings')
      .send({ requireAdminTotp: true })
      .expect(200);
    await admin
      .get('/api/admin/stats')
      .expect(403)
      .expect(({ body }) => expect(body.errorCode).toBe('TOTP_REQUIRED'));
    await admin.post('/api/auth/totp/setup').expect(200);
    await restoreSettings(app);
    await admin.get('/api/admin/settings').expect(200);
  });

  it('reports counts and the audit log', async () => {
    const stats = await admin.get('/api/admin/stats').expect(200);
    expect(Object.keys(stats.body as object).sort()).toEqual([
      'activeKidsLast7Days',
      'kids',
      'users',
    ]);
    expect(stats.body.users).toBeGreaterThan(1);

    const parent = newClient(app);
    await login(parent, ADMIN_EMAIL, 'admin-Password-0123');
    const log = await admin
      .get('/api/admin/audit-log')
      .query({ action: 'auth.login', pageSize: 3 })
      .expect(200);
    expect(log.body.items).toHaveLength(3);
    expect(log.body.items[0]).toMatchObject({
      action: 'auth.login',
      targetType: 'user',
    });
    expect(log.body.items[0].ip).toMatch(/^\d+\.\d+\.\d+\.0$/);
    await admin
      .get('/api/admin/audit-log')
      .query({ action: 'nope' })
      .expect(400);
  });
});
