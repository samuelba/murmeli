import type { NestExpressApplication } from '@nestjs/platform-express';
import { type Challenge, solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import { DataSource } from 'typeorm';
import { type Agent, newClient } from './client';

export const ADMIN_EMAIL = 'admin@murmeli.test';
export const ADMIN_PASSWORD = 'admin-Password-0123';
export const PASSWORD = 'parent-Password-0123';

export async function altchaPayload(client: Agent): Promise<string> {
  const response = await client.get('/api/auth/altcha').expect(200);
  const challenge = response.body as Challenge;
  const solution = await solveChallenge({ challenge, deriveKey });
  if (!solution) {
    throw new Error('ALTCHA challenge not solved');
  }
  return Buffer.from(JSON.stringify({ challenge, solution })).toString(
    'base64',
  );
}

/**
 * Signs in as the first admin, creating it through the setup flow when the
 * users table is still empty.
 */
export async function adminClient(app: NestExpressApplication): Promise<Agent> {
  const client = newClient(app);
  const config = await client.get('/api/auth/config').expect(200);
  if ((config.body as { setupRequired: boolean }).setupRequired) {
    await client
      .post('/api/auth/setup')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, locale: 'en-US' })
      .expect(201);
    return client;
  }
  await login(client, ADMIN_EMAIL, ADMIN_PASSWORD);
  return client;
}

export async function login(
  client: Agent,
  email: string,
  password: string,
): Promise<void> {
  await client
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200)
    .expect((response) => {
      if (!(response.body as { user?: unknown }).user) {
        throw new Error('Expected a signed-in user');
      }
    });
}

/**
 * Creates a verified parent directly in the database and signs them in.
 */
export async function parentClient(
  app: NestExpressApplication,
  email: string,
  password = PASSWORD,
): Promise<Agent> {
  const admin = await adminClient(app);
  const created = await admin
    .post('/api/admin/invites')
    .send({ email, role: 'parent' })
    .expect(201);
  const token = (created.body as { inviteUrl: string }).inviteUrl
    .split('/')
    .pop();
  const client = newClient(app);
  await client
    .post(`/api/invites/${token}/accept`)
    .send({ password, locale: 'de-CH', acceptTerms: true })
    .expect(201);
  return client;
}

export async function setRegistration(
  admin: Agent,
  registrationEnabled: boolean,
): Promise<void> {
  await admin
    .patch('/api/admin/settings')
    .send({ registrationEnabled })
    .expect(200);
}

/**
 * Hands the settings back to the env defaults, as other e2e suites expect.
 */
export async function restoreSettings(
  app: NestExpressApplication,
): Promise<void> {
  const registration = process.env.REGISTRATION_ENABLED === 'true';
  await app.get(DataSource).query(
    `UPDATE "app_settings" SET "source" = 'env', "value" = CASE "key"
       WHEN 'registration_enabled' THEN $1::jsonb ELSE 'false'::jsonb END
     WHERE "key" IN ('registration_enabled', 'require_admin_totp')`,
    [JSON.stringify(registration)],
  );
}
