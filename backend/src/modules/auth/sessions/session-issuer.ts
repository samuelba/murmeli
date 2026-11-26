import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { RequestMeta } from '../../../common/http/request-meta';
import { durationToSeconds } from '../../../common/time/duration';
import type { Env } from '../../../config/env.schema';
import { AuditService } from '../../audit/audit.service';
import type { UserEntity } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import { type UserView, toUserView } from '../../users/user.view';
import {
  COOKIE_ACCESS,
  COOKIE_PARENT_GATE,
  COOKIE_REFRESH,
  COOKIE_TOTP,
  PARENT_GATE_MAX_SECONDS,
  PARENT_GATE_TTL_SECONDS,
} from '../auth.constants';
import { AuthCookies } from '../cookies/auth-cookies';
import { TokenService } from '../tokens/token.service';
import { type NewSession, SessionService } from './session.service';

export type SignInMethod =
  'password' | 'totp' | 'recovery_code' | 'setup' | 'invite';

/**
 * Turns a verified user into a signed-in browser: a new refresh family, the
 * access cookie and an unlocked parent gate.
 */
@Injectable()
export class SessionIssuer {
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly cookies: AuthCookies,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = durationToSeconds(
      config.get('JWT_ACCESS_EXPIRATION', { infer: true }),
    );
  }

  async signIn(
    response: Response,
    user: UserEntity,
    meta: RequestMeta,
    method: SignInMethod,
  ): Promise<UserView> {
    const session = await this.sessions.start(user.id, meta.userAgent);
    this.setSessionCookies(response, user.id, session);
    this.openParentGate(response, user.id, session.familyId);
    this.cookies.clear(response, COOKIE_TOTP);
    const updated = await this.users.update(user.id, {
      lastLoginAt: new Date(),
    });
    await this.audit.record({
      action: 'auth.login',
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      ip: meta.ip,
      meta: { method },
    });
    return toUserView(updated ?? user);
  }

  setSessionCookies(
    response: Response,
    userId: string,
    session: NewSession,
  ): void {
    this.setAccessCookie(response, userId, session.familyId);
    this.cookies.set(
      response,
      COOKIE_REFRESH,
      session.refreshToken,
      session.refreshExpiresAt,
    );
  }

  setAccessCookie(response: Response, userId: string, familyId: string): void {
    const access = this.tokens.sign(
      'access',
      { sub: userId, fam: familyId },
      this.accessTtlSeconds,
    );
    this.cookies.set(response, COOKIE_ACCESS, access.token, access.expiresAt);
  }

  /**
   * Opens or renews the gate: ten minutes from now, but never more than
   * thirty minutes after the password was entered (`authTime`, seconds).
   */
  openParentGate(
    response: Response,
    userId: string,
    familyId: string,
    authTime = Math.floor(Date.now() / 1000),
  ): Date {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.min(
      PARENT_GATE_TTL_SECONDS,
      authTime + PARENT_GATE_MAX_SECONDS - now,
    );
    const gate = this.tokens.sign(
      'parent_gate',
      { sub: userId, fam: familyId, ath: authTime },
      Math.max(1, ttl),
    );
    this.cookies.set(response, COOKIE_PARENT_GATE, gate.token, gate.expiresAt);
    return gate.expiresAt;
  }

  closeParentGate(response: Response): void {
    this.cookies.clear(response, COOKIE_PARENT_GATE);
  }
}
