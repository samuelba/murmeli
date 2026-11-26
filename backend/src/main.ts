import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { exitOnFatal } from './bootstrap/fatal';
import { SWAGGER_PATH, setupSwagger } from './bootstrap/swagger';
import { type AppConfigService, pickEnv } from './config/app-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();

  const env = pickEnv(app.get<AppConfigService>(ConfigService), [
    'NODE_ENV',
    'PORT',
    'TRUST_PROXY',
    'APP_URL',
    'CORS_ORIGINS',
  ]);
  configureApp(app, env);

  if (env.NODE_ENV !== 'production') {
    setupSwagger(app);
    logger.log(`Swagger UI on /${SWAGGER_PATH}`, 'Bootstrap');
  }

  await app.listen(env.PORT);
  logger.log(`Listening on port ${env.PORT}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => exitOnFatal(error));
