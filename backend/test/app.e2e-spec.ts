import { Global, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { DatabaseModule } from '../src/database/database.module';
import { REDIS_CLIENT } from '../src/redis/redis.options';

const fakeDataSource = {
  query: jest.fn(),
  options: { type: 'postgres' },
  entityMetadatas: [],
  getRepository: jest.fn(() => ({})),
};
const fakeRedis = {
  status: 'ready',
  ping: jest.fn(),
  eval: jest.fn().mockResolvedValue([1, 60_000, 0, 0]),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn(),
};

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: fakeDataSource }],
  exports: [DataSource],
})
class FakeDatabaseModule {}

describe('Health (e2e, no external services)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(FakeDatabaseModule)
      .overrideProvider(REDIS_CLIENT)
      .useValue(fakeRedis)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app, {
      NODE_ENV: 'production',
      TRUST_PROXY: 1,
      APP_URL: 'https://murmeli.example.com',
      CORS_ORIGINS: [],
    });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    fakeDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    fakeRedis.ping.mockResolvedValue('PONG');
  });

  it('GET /api/health reports liveness with a request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' });

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
  });

  it('GET /api/health is not rate limited', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    expect(fakeRedis.eval).not.toHaveBeenCalled();
  });

  it('GET /api/health/ready is 200 when Postgres and Redis answer', async () => {
    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200, { status: 'ok', checks: { database: 'up', redis: 'up' } });
  });

  it('GET /api/health/ready is 503 when a dependency is down', async () => {
    fakeRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(503);

    expect(response.body).toEqual({
      status: 'error',
      checks: { database: 'up', redis: 'down' },
    });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/nope')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      errorCode: 'NOT_FOUND',
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
