import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX } from '../../../bootstrap/configure-app';
import type { Env } from '../../../config/env.schema';
import {
  COOKIE_ACCESS,
  COOKIE_KID,
  COOKIE_PARENT_GATE,
  COOKIE_REFRESH,
  COOKIE_TOTP,
} from '../auth.constants';

export const COOKIE_PATHS: Readonly<Record<string, string>> = {
  [COOKIE_ACCESS]: `/${API_PREFIX}`,
  [COOKIE_REFRESH]: `/${API_PREFIX}/auth`,
  [COOKIE_TOTP]: `/${API_PREFIX}/auth/totp`,
  [COOKIE_PARENT_GATE]: `/${API_PREFIX}`,
  [COOKIE_KID]: `/${API_PREFIX}`,
};

export const ALL_COOKIES = Object.keys(COOKIE_PATHS);

export function readCookie(request: Request, name: string): string | undefined {
  const value = (request.cookies as Record<string, unknown> | undefined)?.[
    name
  ];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Sets and clears the `mu_*` cookies: always httpOnly and SameSite=Strict,
 * Secure per COOKIE_SECURE, Domain per COOKIE_DOMAIN.
 */
@Injectable()
export class AuthCookies {
  private readonly secure: boolean;
  private readonly domain: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.secure = config.get('COOKIE_SECURE', { infer: true });
    this.domain = config.get('COOKIE_DOMAIN', { infer: true });
  }

  options(name: string): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'strict',
      path: COOKIE_PATHS[name],
      ...(this.domain !== undefined && { domain: this.domain }),
    };
  }

  set(response: Response, name: string, value: string, expiresAt: Date): void {
    response.cookie(name, value, {
      ...this.options(name),
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
  }

  clear(response: Response, ...names: string[]): void {
    for (const name of names) {
      response.clearCookie(name, this.options(name));
    }
  }

  clearAll(response: Response): void {
    this.clear(response, ...ALL_COOKIES);
  }
}
