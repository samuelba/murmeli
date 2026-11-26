import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { AppSettingsBootstrap } from '../src/settings/app-settings.bootstrap';

const describeWithDb = process.env.E2E_DB === '1' ? describe : describe.skip;

describeWithDb('Readiness (e2e, real Postgres and Redis)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app, {
      NODE_ENV: 'test',
      TRUST_PROXY: 1,
      APP_URL: 'https://murmeli.example.com',
      CORS_ORIGINS: [],
    });
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/health/ready is 200', async () => {
    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200, { status: 'ok', checks: { database: 'up', redis: 'up' } });
  });

  it('ran the initial migration at startup', async () => {
    const dataSource = app.get(DataSource);

    expect(await dataSource.showMigrations()).toBe(false);
    const [uuid] = await dataSource.query<{ id: string }[]>(
      'SELECT uuid_generate_v7() AS id',
    );
    expect(uuid.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  describe('registration_enabled', () => {
    const select = `SELECT "value", "source" FROM "app_settings" WHERE "key" = 'registration_enabled'`;
    const expected = process.env.REGISTRATION_ENABLED === 'true';

    afterAll(() =>
      app
        .get(DataSource)
        .query(
          `UPDATE "app_settings" SET "source" = 'env' WHERE "key" = 'registration_enabled'`,
        ),
    );

    it('is applied from REGISTRATION_ENABLED at startup', async () => {
      const [setting] = await app
        .get(DataSource)
        .query<{ value: boolean; source: string }[]>(select);

      expect(setting).toEqual({ value: expected, source: 'env' });
    });

    it('is left alone once an admin changed it', async () => {
      const dataSource = app.get(DataSource);
      await dataSource.query(
        `UPDATE "app_settings" SET "value" = $1::jsonb, "source" = 'admin' WHERE "key" = 'registration_enabled'`,
        [JSON.stringify(!expected)],
      );

      await app.get(AppSettingsBootstrap).onApplicationBootstrap();

      const [setting] = await dataSource.query<{ value: boolean }[]>(select);
      expect(setting.value).toBe(!expected);
    });
  });
});
