import type { NestExpressApplication } from '@nestjs/platform-express';
import { generateCode } from '../../src/modules/auth/totp/totp-codes';
import {
  type Agent,
  cookieLine,
  newClient,
  uniqueEmail,
} from '../support/client';
import { createE2eApp, describeWithDb } from '../support/e2e-app';
import { PASSWORD, parentClient } from '../support/flows';

const STEP_MS = 30_000;

function secretOf(otpauthUrl: string): string {
  return new URL(otpauthUrl).searchParams.get('secret') ?? '';
}

describeWithDb('TOTP (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(() => app.close());

  async function enableTotp(
    client: Agent,
  ): Promise<{ secret: string; codes: string[] }> {
    const setup = await client.post('/api/auth/totp/setup').expect(200);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(setup.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const secret = secretOf(setup.body.otpauthUrl as string);

    await client
      .post('/api/auth/totp/enable')
      .send({ code: '000000' === generateCode(secret) ? '111111' : '000000' })
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('TOTP_INVALID'));
    const enabled = await client
      .post('/api/auth/totp/enable')
      .send({ code: generateCode(secret) })
      .expect(200);
    expect(enabled.body.recoveryCodes).toHaveLength(10);
    return { secret, codes: enabled.body.recoveryCodes as string[] };
  }

  async function passwordStep(email: string): Promise<Agent> {
    const client = newClient(app);
    const response = await client
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200, { totpRequired: true });
    expect(cookieLine(response, 'mu_totp')).toMatch(/Path=\/api\/auth\/totp/);
    expect(cookieLine(response, 'mu_at')).toBeUndefined();
    return client;
  }

  it('enables TOTP, then signs in in two steps with a code or a recovery code', async () => {
    const email = uniqueEmail('totp');
    const parent = await parentClient(app, email);
    const { secret, codes } = await enableTotp(parent);
    await parent
      .get('/api/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.user.totpEnabled).toBe(true));

    const second = await passwordStep(email);
    await second.get('/api/auth/me').expect(401);
    const nextCode = generateCode(secret, Date.now() + STEP_MS);
    await second
      .post('/api/auth/totp/verify')
      .send({ code: nextCode })
      .expect(200)
      .expect(({ body }) => expect(body.user.email).toBe(email));
    await second.get('/api/auth/me').expect(200);

    const replay = await passwordStep(email);
    await replay
      .post('/api/auth/totp/verify')
      .send({ code: nextCode })
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('TOTP_INVALID'));

    const recovery = await passwordStep(email);
    await recovery
      .post('/api/auth/totp/verify')
      .send({ recoveryCode: codes[0] })
      .expect(200);
    const reused = await passwordStep(email);
    await reused
      .post('/api/auth/totp/verify')
      .send({ recoveryCode: codes[0] })
      .expect(401);
  });

  it('limits wrong codes per sign-in attempt', async () => {
    const email = uniqueEmail('totp-limit');
    const parent = await parentClient(app, email);
    await enableTotp(parent);
    const client = await passwordStep(email);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await client
        .post('/api/auth/totp/verify')
        .send({ recoveryCode: 'AAAA-AAAA-AAAA' })
        .expect(401);
    }
    const locked = await client
      .post('/api/auth/totp/verify')
      .send({ recoveryCode: 'AAAA-AAAA-AAAA' })
      .expect(429);
    expect(locked.body.errorCode).toBe('RATE_LIMITED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts wrong codes per user across sign-ins', async () => {
    const email = uniqueEmail('totp-user');
    const parent = await parentClient(app, email);
    const { secret } = await enableTotp(parent);

    for (const _login of [1, 2]) {
      const client = await passwordStep(email);
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await client
          .post('/api/auth/totp/verify')
          .send({ recoveryCode: 'BBBB-BBBB-BBBB' })
          .expect(401);
      }
    }
    const third = await passwordStep(email);
    await third
      .post('/api/auth/totp/verify')
      .send({ code: generateCode(secret, Date.now() + STEP_MS) })
      .expect(429);
    await parent
      .post('/api/auth/totp/recovery-codes')
      .send({ code: generateCode(secret, Date.now() + STEP_MS) })
      .expect(429);
  });

  it('regenerates recovery codes and disables TOTP', async () => {
    const parent = await parentClient(app, uniqueEmail('totp-off'));
    const { secret, codes } = await enableTotp(parent);

    const regenerated = await parent
      .post('/api/auth/totp/recovery-codes')
      .send({ code: generateCode(secret, Date.now() + STEP_MS) })
      .expect(200);
    expect(regenerated.body.recoveryCodes).toHaveLength(10);
    expect(regenerated.body.recoveryCodes).not.toContain(codes[1]);

    await parent
      .post('/api/auth/totp/disable')
      .send({
        password: 'wrong-Password-1',
        code: regenerated.body.recoveryCodes[0],
      })
      .expect(401)
      .expect(({ body }) => expect(body.errorCode).toBe('INVALID_CREDENTIALS'));
    await parent
      .post('/api/auth/totp/disable')
      .send({ password: PASSWORD, code: regenerated.body.recoveryCodes[0] })
      .expect(204);
    await parent
      .get('/api/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.user.totpEnabled).toBe(false));
  });
});
