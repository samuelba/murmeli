import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { pickEnv } from '../../config/app-config';
import type { Env } from '../../config/env.schema';
import { buildAllowedOrigins, isOriginAllowed } from '../http/allowed-origins';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TRUSTED_FETCH_SITES = new Set(['same-origin', 'none']);

/**
 * CSRF defence without tokens: state-changing browser requests must come from
 * the app's own origin (Sec-Fetch-Site) or an allowlisted Origin. Non-browser
 * clients send neither header and are not affected.
 */
@Injectable()
export class SameOriginGuard implements CanActivate {
  private readonly allowedOrigins: readonly string[];

  constructor(config: ConfigService<Env, true>) {
    const env = pickEnv(config, ['APP_URL', 'CORS_ORIGINS']);
    this.allowedOrigins = buildAllowedOrigins(env.APP_URL, env.CORS_ORIGINS);
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const site = request.headers['sec-fetch-site'];
    if (typeof site === 'string' && TRUSTED_FETCH_SITES.has(site)) {
      return true;
    }

    const origin = request.headers.origin;
    if (origin === undefined) {
      if (site === undefined) {
        return true;
      }
      throw new ForbiddenException('Cross-origin requests are not allowed');
    }
    if (isOriginAllowed(origin, this.allowedOrigins)) {
      return true;
    }
    throw new ForbiddenException('Cross-origin requests are not allowed');
  }
}
