import type { ModuleMetadata } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap/configure-app';

export const describeWithDb =
  process.env.E2E_DB === '1' ? describe : describe.skip;

export const describeWithMail =
  process.env.E2E_DB === '1' && process.env.MAILPIT_URL
    ? describe
    : describe.skip;

export function appUrl(): string {
  return process.env.APP_URL ?? 'https://murmeli.example.com';
}

export async function createE2eApp(
  extra: Pick<ModuleMetadata, 'imports' | 'controllers' | 'providers'> = {},
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...(extra.imports ?? [])],
    controllers: extra.controllers ?? [],
    providers: extra.providers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app, {
    NODE_ENV: 'test',
    TRUST_PROXY: 1,
    APP_URL: appUrl(),
    CORS_ORIGINS: [],
  });
  await app.init();
  return app;
}
