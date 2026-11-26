import type { NestExpressApplication } from '@nestjs/platform-express';
import { newClient, uniqueEmail, withoutRequestId } from '../support/client';
import { createE2eApp, describeWithDb } from '../support/e2e-app';
import {
  ADMIN_EMAIL,
  PASSWORD,
  altchaPayload,
  parentClient,
} from '../support/flows';

const TIMING_SAMPLES = 4;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

describeWithDb('Security (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(() => app.close());

  it('locks an address from one network after five wrong passwords', async () => {
    const email = uniqueEmail('locked');
    await parentClient(app, email);
    const attacker = newClient(app);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await attacker
        .post('/api/auth/login')
        .send({ email, password: 'wrong-Password-1' })
        .expect(401);
    }
    const locked = await attacker
      .post('/api/auth/login')
      .send({ email, password: 'wrong-Password-1' })
      .expect(429);
    expect(locked.body.errorCode).toBe('RATE_LIMITED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(800);
    await attacker
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(429);

    await newClient(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
  });

  it('locks unknown addresses exactly like existing ones', async () => {
    const email = uniqueEmail('nobody');
    const client = newClient(app);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await client
        .post('/api/auth/login')
        .send({ email, password: 'wrong-Password-1' })
        .expect(401);
    }
    await client
      .post('/api/auth/login')
      .send({ email, password: 'wrong-Password-1' })
      .expect(429);
  });

  it('caps failed sign-ins per address across all networks', async () => {
    const email = uniqueEmail('spread');
    await parentClient(app, email);
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      await newClient(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong-Password-1' })
        .expect(401);
    }
    await newClient(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(429);
  });

  it('does not let concurrent guesses slip past the limit', async () => {
    const email = uniqueEmail('burst');
    const client = newClient(app);
    const statuses = await Promise.all(
      Array.from({ length: 8 }, () =>
        client
          .post('/api/auth/login')
          .send({ email, password: 'wrong-Password-1' })
          .then((response) => response.status),
      ),
    );
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(3);
  });

  it('limits sign-ins per IP with Retry-After', async () => {
    const client = newClient(app);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await client
        .post('/api/auth/login')
        .send({ email: uniqueEmail('ip'), password: 'wrong-Password-1' })
        .expect(401);
    }
    const limited = await client
      .post('/api/auth/login')
      .send({ email: uniqueEmail('ip'), password: 'wrong-Password-1' })
      .expect(429);
    expect(limited.body.errorCode).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits email-sending routes to five per IP and hour', async () => {
    const client = newClient(app);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await client
        .post('/api/auth/forgot-password')
        .send({
          email: uniqueEmail('mail'),
          altcha: await altchaPayload(client),
        })
        .expect(202);
    }
    const limited = await client
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('mail'), altcha: await altchaPayload(client) })
      .expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(3000);
  });

  it('rejects cross-site state changes before anything else', async () => {
    const client = newClient(app);
    await client
      .post('/api/auth/login')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Origin', 'https://evil.example')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(403);
    await client
      .post('/api/kids')
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);
    await client
      .post('/api/auth/login')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ email: uniqueEmail(), password: PASSWORD })
      .expect(401);
  });

  it('answers unknown accounts and wrong passwords identically', async () => {
    const email = uniqueEmail('timing');
    await parentClient(app, email);
    const unknown: number[] = [];
    const wrong: number[] = [];
    const bodies = new Set<string>();

    for (let sample = 0; sample < TIMING_SAMPLES; sample += 1) {
      for (const [target, list] of [
        [uniqueEmail('ghost'), unknown],
        [email, wrong],
      ] as const) {
        const started = performance.now();
        const response = await newClient(app)
          .post('/api/auth/login')
          .send({ email: target, password: `wrong-Password-${sample}` });
        list.push(performance.now() - started);
        bodies.add(
          `${response.status} ${JSON.stringify(withoutRequestId(response.body))}`,
        );
      }
    }

    expect([...bodies]).toEqual([
      '401 {"statusCode":401,"errorCode":"INVALID_CREDENTIALS","message":"Invalid email or password"}',
    ]);
    const ratio = median(unknown) / median(wrong);
    expect(ratio).toBeGreaterThan(0.33);
    expect(ratio).toBeLessThan(3);
  });
});
