import { Body, Controller, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { configureApp, type HttpEnv } from './configure-app';
import { setupSwagger } from './swagger';

class EchoDto {
  @IsString()
  name: string;
}

@Controller('probe')
class ProbeController {
  @Post('echo')
  echo(@Body() body: EchoDto): EchoDto {
    return body;
  }

  @Get('boom')
  boom(): never {
    throw new Error('database password is hunter2');
  }

  @Get('ip')
  ip(): string {
    return 'ok';
  }
}

async function createApp(env: Partial<HttpEnv> = {}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app, {
    NODE_ENV: 'production',
    TRUST_PROXY: 1,
    APP_URL: 'https://murmeli.example.com',
    CORS_ORIGINS: ['http://localhost:4200'],
    ...env,
  });
  return app;
}

describe('configureApp', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(() => app.close());

  it('serves routes under /api with strict security headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/probe/ip')
      .expect(200);

    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'",
    );
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['pragma']).toBe('no-cache');
  });

  it('answers CORS preflights only for allowed origins', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/api/probe/echo')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'POST');
    const denied = await request(app.getHttpServer())
      .options('/api/probe/echo')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:4200',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects unknown properties with VALIDATION_FAILED details', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/echo')
      .send({ name: 'Mia', admin: true })
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      errorCode: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: [
        {
          field: 'admin',
          constraints: ['whitelistValidation'],
          messages: ['property admin should not exist'],
        },
      ],
    });
  });

  it('answers malformed JSON with INVALID_JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/echo')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      errorCode: 'INVALID_JSON',
      message: 'The request body is not valid JSON',
    });
  });

  it('limits JSON bodies to 100kb', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/echo')
      .send({ name: 'x'.repeat(101 * 1024) })
      .expect(413);

    expect(response.body).toMatchObject({ errorCode: 'PAYLOAD_TOO_LARGE' });
  });

  it('accepts valid bodies', async () => {
    await request(app.getHttpServer())
      .post('/api/probe/echo')
      .send({ name: 'Mia' })
      .expect(201, { name: 'Mia' });
  });

  it('hides internal errors in production', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/probe/boom')
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    });
  });

  it('trusts the configured number of proxies', () => {
    expect(app.getHttpAdapter().getInstance().get('trust proxy')).toBe(1);
  });
});

describe('setupSwagger', () => {
  it('publishes the OpenAPI document outside production', async () => {
    const app = await createApp({ NODE_ENV: 'development' });
    setupSwagger(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.body.info.title).toBe('Murmeli API');
    expect(response.headers['content-security-policy']).toBeUndefined();
    await app.close();
  });
});
