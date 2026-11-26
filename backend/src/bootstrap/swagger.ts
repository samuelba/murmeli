import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BRAND_NAME } from '../config/brand';
import { API_PREFIX } from './configure-app';

export const SWAGGER_PATH = `${API_PREFIX}/docs`;

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder().setTitle(`${BRAND_NAME} API`).build();
  SwaggerModule.setup(SWAGGER_PATH, app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
