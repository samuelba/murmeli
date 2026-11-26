import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { TokenService } from '../../src/modules/auth/tokens/token.service';
import { KidGuard, type KidRequest } from '../../src/modules/kids/kid.guard';
import { KidsModule } from '../../src/modules/kids/kids.module';
import {
  type Agent,
  cookieLine,
  cookieValue,
  jwtClaims,
  newClient,
  putCookie,
  uniqueEmail,
} from '../support/client';
import { createE2eApp, describeWithDb } from '../support/e2e-app';
import { PASSWORD, parentClient } from '../support/flows';

@Controller('e2e-kid')
class KidProbeController {
  @UseGuards(KidGuard)
  @Get()
  probe(@Req() request: KidRequest): { kidId: string | undefined } {
    return { kidId: request.kid?.id };
  }
}

const KID = {
  nickname: 'Zoë-Anaïs 2',
  avatar: { animal: 'marmot', accessory: 'crown', background: '#FFD8A8' },
  startClass: 'KG2',
  language: 'de-CH',
  dailyLimitMinutes: 30,
  soundEnabled: true,
  readAloud: 'auto',
};

describeWithDb('Parent gate and kids (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createE2eApp({
      imports: [KidsModule],
      controllers: [KidProbeController],
    });
  });

  afterAll(() => app.close());

  function createKid(client: Agent, body: object = KID) {
    return client.post('/api/kids').send(body);
  }

  it('locks, unlocks and expires the parent gate', async () => {
    const parent = await parentClient(app, uniqueEmail('gate'));
    const renewed = await parent.get('/api/account/export').expect(200);
    expect(cookieLine(renewed, 'mu_pg')).toMatch(/Max-Age=(599|600);/);

    await parent.post('/api/auth/parent-gate/lock').expect(204);
    await parent
      .get('/api/account/export')
      .expect(403)
      .expect(({ body }) =>
        expect(body.errorCode).toBe('PARENT_GATE_REQUIRED'),
      );
    await parent.get('/api/kids').expect(200);
    await parent
      .get('/api/auth/me')
      .expect(({ body }) => expect(body.parentGateExpiresAt).toBeNull());

    await parent
      .post('/api/auth/parent-gate')
      .send({ password: 'wrong-Password-9' })
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('INVALID_CREDENTIALS'));
    const unlocked = await parent
      .post('/api/auth/parent-gate')
      .send({ password: PASSWORD })
      .expect(200);
    expect(
      Date.parse(String(unlocked.body.parentGateExpiresAt)),
    ).toBeGreaterThan(Date.now());

    const claims = jwtClaims(cookieValue(unlocked, 'mu_pg') ?? '');
    const expired = app.get(TokenService).sign(
      'parent_gate',
      {
        sub: String(claims.sub),
        fam: String(claims.fam),
        ath: Number(claims.ath),
      },
      1,
      Date.now() - 10_000,
    );
    putCookie(parent, 'mu_pg', expired.token);
    await parent
      .get('/api/account/export')
      .expect(403)
      .expect(({ body }) =>
        expect(body.errorCode).toBe('PARENT_GATE_REQUIRED'),
      );
  });

  it('locks the gate after too many wrong passwords', async () => {
    const parent = await parentClient(app, uniqueEmail('gate-limit'));
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await parent
        .post('/api/auth/parent-gate')
        .send({ password: 'nope-nope-1' })
        .expect(401);
    }
    const locked = await parent
      .post('/api/auth/parent-gate')
      .send({ password: 'nope-nope-1' })
      .expect(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    await parent
      .post('/api/auth/parent-gate')
      .send({ password: PASSWORD })
      .expect(429);
  });

  it('creates, lists, updates and deletes kids', async () => {
    const parent = await parentClient(app, uniqueEmail('kids'));
    const created = await createKid(parent).expect(201);
    expect(created.body).toMatchObject({
      nickname: 'Zoë-Anaïs 2',
      hasPin: false,
      birthYear: null,
      dailyLimitMinutes: 30,
    });
    const id = created.body.id as string;

    await createKid(parent, {
      ...KID,
      avatar: { ...KID.avatar, animal: 'velociraptor' },
    })
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('AVATAR_INVALID'));
    await createKid(parent, { ...KID, nickname: 'Bobby<script>' })
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('VALIDATION_FAILED'));

    const updated = await parent
      .patch(`/api/kids/${id}`)
      .send({
        ...KID,
        nickname: 'Lou',
        pin: [0, 8, 8, 1],
        dailyLimitMinutes: null,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      nickname: 'Lou',
      hasPin: true,
      dailyLimitMinutes: null,
    });
    await parent
      .patch(`/api/kids/${id}`)
      .send({ pin: null })
      .expect(200)
      .expect(({ body }) => expect(body.hasPin).toBe(false));

    await parent
      .get('/api/kids')
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(1));
    await parent
      .patch('/api/kids/not-a-uuid')
      .send({ nickname: 'X' })
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('VALIDATION_FAILED'));
    await parent.delete(`/api/kids/${id}`).expect(204);
    await parent
      .delete(`/api/kids/${id}`)
      .expect(404)
      .expect(({ body }) => expect(body.errorCode).toBe('KID_NOT_FOUND'));
  });

  it('allows at most eight kids', async () => {
    const parent = await parentClient(app, uniqueEmail('many'));
    for (let index = 0; index < 8; index += 1) {
      await createKid(parent, { ...KID, nickname: `Kid ${index}` }).expect(201);
    }
    await createKid(parent)
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('KID_LIMIT'));
  });

  it('activates a kid with the picture PIN and locks after wrong PINs', async () => {
    const parent = await parentClient(app, uniqueEmail('pin'));
    const kid = await createKid(parent, { ...KID, pin: [3, 1, 4, 1] }).expect(
      201,
    );
    const id = kid.body.id as string;

    await parent.get('/api/e2e-kid').expect(403);
    await parent.post(`/api/kids/${id}/activate`).send({}).expect(401);
    for (let attempt = 2; attempt <= 5; attempt += 1) {
      await parent
        .post(`/api/kids/${id}/activate`)
        .send({ pin: [0, 0, 0, 0] })
        .expect(401)
        .expect(({ body }) => expect(body.errorCode).toBe('PIN_INVALID'));
    }
    const locked = await parent
      .post(`/api/kids/${id}/activate`)
      .send({ pin: [0, 0, 0, 0] })
      .expect(429);
    expect(locked.body.errorCode).toBe('PIN_LOCKED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    await parent
      .post(`/api/kids/${id}/activate`)
      .send({ pin: [3, 1, 4, 1] })
      .expect(429);

    const [entry] = await app
      .get(DataSource)
      .query<{ target_id: string; meta: unknown }[]>(
        `SELECT "target_id", "meta" FROM "audit_log" WHERE "action" = 'kid.pin_locked' AND "target_id" = $1`,
        [id],
      );
    expect(entry.target_id).toBe(id);
    expect(JSON.stringify(entry)).not.toContain('Zoë');
  });

  it('sets mu_kid, closes the gate and lets KidGuard through', async () => {
    const parent = await parentClient(app, uniqueEmail('active'));
    const kid = await createKid(parent, { ...KID, pin: [1, 2, 3, 4] }).expect(
      201,
    );
    const id = kid.body.id as string;

    const activated = await parent
      .post(`/api/kids/${id}/activate`)
      .send({ pin: [1, 2, 3, 4] })
      .expect(200);
    expect(activated.body.id).toBe(id);
    expect(cookieValue(activated, 'mu_kid')).toBeTruthy();
    expect(cookieValue(activated, 'mu_pg')).toBe('');

    await parent.get('/api/e2e-kid').expect(200, { kidId: id });
    await parent
      .get('/api/auth/me')
      .expect(({ body }) => expect(body.activeKid.id).toBe(id));
    await parent.delete(`/api/kids/${id}`).expect(403);

    const other = await parentClient(app, uniqueEmail('other'));
    putCookie(other, 'mu_kid', cookieValue(activated, 'mu_kid') ?? '');
    await other.get('/api/e2e-kid').expect(403);
    await other
      .get('/api/auth/me')
      .expect(({ body }) => expect(body.activeKid).toBeNull());
    await newClient(app).get('/api/e2e-kid').expect(401);

    await parent.post('/api/kids/deactivate').expect(204);
    await parent.get('/api/e2e-kid').expect(403);
  });
});
