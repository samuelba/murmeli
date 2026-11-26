import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { buildAllowedOrigins } from '../common/http/allowed-origins';
import { validationExceptionFactory } from '../common/validation/validation-exception.factory';
import type { Env } from '../config/env.schema';
import { buildHelmetOptions } from './helmet.options';

export const API_PREFIX = 'api';
export const BODY_LIMIT = '100kb';

export type HttpEnv = Pick<
  Env,
  'NODE_ENV' | 'TRUST_PROXY' | 'APP_URL' | 'CORS_ORIGINS'
>;

export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

export function configureApp(
  app: NestExpressApplication,
  env: HttpEnv,
): NestExpressApplication {
  const isProduction = env.NODE_ENV === 'production';

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet(buildHelmetOptions(isProduction)));
  app.use(noStore);
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });
  app.use(cookieParser());
  app.enableCors({
    origin: [...buildAllowedOrigins(env.APP_URL, env.CORS_ORIGINS)],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(isProduction));
  app.enableShutdownHooks();

  return app;
}
