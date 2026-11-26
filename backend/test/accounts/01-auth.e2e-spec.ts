import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  cookieLine,
  cookieValue,
  newClient,
  uniqueEmail,
} from '../support/client';
import { createE2eApp, describeWithDb } from '../support/e2e-app';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  PASSWORD,
  adminClient,
  login,
  parentClient,
} from '../support/flows';

describeWithDb('Auth (e2e, real Postgres and Redis)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(() => app.close());

  it('runs the setup once, signs the first admin in and opens the gate', async () => {
    const client = newClient(app);
    const config = await client.get('/api/auth/config').expect(200);
    expect(config.body).toMatchObject({ setupRequired: true });

    const setup = await client
      .post('/api/auth/setup')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, locale: 'en-US' })
      .expect(201);
    expect(setup.body.user).toMatchObject({
      email: ADMIN_EMAIL,
      role: 'admin',
      emailVerified: true,
      totpEnabled: false,
    });
    for (const name of ['mu_at', 'mu_rt', 'mu_pg']) {
      expect(cookieLine(setup, name)).toMatch(/HttpOnly/);
      expect(cookieLine(setup, name)).toMatch(/SameSite=Strict/);
    }
    expect(cookieLine(setup, 'mu_rt')).toMatch(/Path=\/api\/auth/);

    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe(ADMIN_EMAIL);
    expect(me.body.activeKid).toBeNull();
    expect(Date.parse(String(me.body.parentGateExpiresAt))).toBeGreaterThan(
      Date.now(),
    );

    await newClient(app)
      .post('/api/auth/setup')
      .send({
        email: 'x@example.com',
        password: ADMIN_PASSWORD,
        locale: 'en-US',
      })
      .expect(403)
      .expect(({ body }) => expect(body.errorCode).toBe('SETUP_COMPLETE'));
  });

  it('signs in, reports the user and signs out', async () => {
    const client = newClient(app);
    await login(client, ADMIN_EMAIL, ADMIN_PASSWORD);
    await client.get('/api/auth/me').expect(200);

    const logout = await client.post('/api/auth/logout').expect(204);
    expect(cookieValue(logout, 'mu_at')).toBe('');
    await client
      .get('/api/auth/me')
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('UNAUTHORIZED'));
  });

  it('rejects requests without a session as UNAUTHORIZED', async () => {
    await newClient(app)
      .get('/api/kids')
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('UNAUTHORIZED'));
  });

  it('rotates refresh tokens and treats reuse as theft', async () => {
    const client = await parentClient(app, uniqueEmail());
    const first = await client.post('/api/auth/refresh').expect(200);
    const stolen = cookieValue(first, 'mu_rt');
    expect(first.body).toEqual({ ok: true });

    const second = await client.post('/api/auth/refresh').expect(200);
    expect(cookieValue(second, 'mu_rt')).not.toBe(stolen);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `mu_rt=${stolen}`)
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('SESSION_COMPROMISED'));

    await client.get('/api/auth/me').expect(401);
    await client.get('/api/account/export').expect(401);
    await client
      .post('/api/auth/refresh')
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('SESSION_EXPIRED'));
  });

  it('answers a refresh without a cookie with SESSION_EXPIRED', async () => {
    await newClient(app)
      .post('/api/auth/refresh')
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('SESSION_EXPIRED'));
  });

  it('refuses disabled accounts only after a correct password', async () => {
    const email = uniqueEmail();
    const parent = await parentClient(app, email);
    const admin = await adminClient(app);
    const users = await admin
      .get('/api/admin/users')
      .query({ search: email })
      .expect(200);
    await admin
      .patch(`/api/admin/users/${users.body.items[0].id}`)
      .send({ disabled: true })
      .expect(200);

    await parent.get('/api/auth/me').expect(401);
    await newClient(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrong-Password-0' })
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('INVALID_CREDENTIALS'));
    await newClient(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(403)
      .expect(({ body }) => expect(body.errorCode).toBe('ACCOUNT_DISABLED'));
  });
});
