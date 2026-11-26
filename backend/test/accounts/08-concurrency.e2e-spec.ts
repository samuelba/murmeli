import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AdminUsersService } from '../../src/modules/admin/admin-users.service';
import { cookieValue, uniqueEmail } from '../support/client';
import { createE2eApp, describeWithDb } from '../support/e2e-app';
import { adminClient, parentClient } from '../support/flows';

describeWithDb('Concurrency (e2e, real Postgres)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(() => app.close());

  it('never demotes the last active admin, even concurrently', async () => {
    const admin = await adminClient(app);
    const invited = await admin
      .post('/api/admin/invites')
      .send({ email: uniqueEmail('second-admin'), role: 'admin' })
      .expect(201);
    const token = (invited.body.inviteUrl as string).split('/').pop() ?? '';
    await request(app.getHttpServer())
      .post(`/api/invites/${token}/accept`)
      .send({
        password: 'second-Admin-123',
        locale: 'en-US',
        acceptTerms: true,
      })
      .expect(201);

    const db = app.get(DataSource);
    const admins = await db.query<{ id: string }[]>(
      `SELECT "id" FROM "users" WHERE "role" = 'admin' AND "disabled" = false`,
    );
    expect(admins.length).toBeGreaterThan(1);
    const service = app.get(AdminUsersService);
    try {
      const results = await Promise.allSettled(
        admins.map(({ id }) =>
          service.update({ userId: id, ip: null }, id, { role: 'parent' }),
        ),
      );
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason as { response: unknown }).toMatchObject({
        response: { errorCode: 'LAST_ADMIN' },
      });
      const [left] = await db.query<{ count: number }[]>(
        `SELECT COUNT(*)::int AS "count" FROM "users" WHERE "role" = 'admin' AND "disabled" = false`,
      );
      expect(left.count).toBe(1);
    } finally {
      await db.query(
        `UPDATE "users" SET "role" = 'admin' WHERE "id" = ANY($1::uuid[])`,
        [admins.map(({ id }) => id)],
      );
    }
  });

  it('accepts a refresh token once when it is replayed concurrently', async () => {
    const client = await parentClient(app, uniqueEmail('race'));
    const first = await client.post('/api/auth/refresh').expect(200);
    const refreshToken = cookieValue(first, 'mu_rt') ?? '';

    const responses = await Promise.all(
      [1, 2, 3].map(() =>
        request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Cookie', `mu_rt=${refreshToken}`),
      ),
    );
    const codes = responses.map((r) =>
      r.status === 200
        ? 'ok'
        : String((r.body as { errorCode: string }).errorCode),
    );
    expect(codes.filter((code) => code === 'ok')).toHaveLength(1);
    expect(codes.filter((code) => code === 'SESSION_COMPROMISED')).toHaveLength(
      2,
    );

    const winner = responses.find((r) => r.status === 200);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `mu_at=${cookieValue(winner!, 'mu_at')}`)
      .expect(401);
  });
});
