import { HttpStatus, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { apiError } from '../../../common/errors/api-exception';
import type { RequestMeta } from '../../../common/http/request-meta';
import { AuditService } from '../../audit/audit.service';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '../auth.constants';
import { AuthCookies, readCookie } from '../cookies/auth-cookies';
import { SESSION_EXPIRED } from '../guards/auth.guard';
import { SessionIssuer } from '../sessions/session-issuer';
import { SessionService } from '../sessions/session.service';
import { TokenService } from '../tokens/token.service';

export const SESSION_COMPROMISED = 'SESSION_COMPROMISED';

/**
 * Refresh (rotation with reuse detection) and logout.
 */
@Injectable()
export class SessionFlowService {
  constructor(
    private readonly sessions: SessionService,
    private readonly issuer: SessionIssuer,
    private readonly cookies: AuthCookies,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async refresh(
    request: Request,
    response: Response,
    meta: RequestMeta,
  ): Promise<void> {
    const refreshToken = readCookie(request, COOKIE_REFRESH);
    const result = refreshToken
      ? await this.sessions.rotate(refreshToken, meta.userAgent)
      : ({ status: 'expired' } as const);

    if (result.status === 'rotated') {
      this.issuer.setSessionCookies(response, result.user.id, result.session);
      return;
    }
    this.cookies.clearAll(response);
    if (result.status === 'compromised') {
      await this.audit.record({
        action: 'auth.session_compromised',
        actorId: result.userId,
        targetType: 'user',
        targetId: result.userId,
        ip: meta.ip,
      });
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        SESSION_COMPROMISED,
        'The session was ended for security reasons',
      );
    }
    throw apiError(
      HttpStatus.UNAUTHORIZED,
      SESSION_EXPIRED,
      'The session has expired',
    );
  }

  async logout(
    request: Request,
    response: Response,
    meta: RequestMeta,
  ): Promise<void> {
    const session = await this.findSession(request);
    this.cookies.clearAll(response);
    if (!session) {
      return;
    }
    await this.sessions.revokeFamily(session.familyId, 'logout');
    await this.audit.record({
      action: 'auth.logout',
      actorId: session.userId,
      targetType: 'user',
      targetId: session.userId,
      ip: meta.ip,
    });
  }

  private async findSession(
    request: Request,
  ): Promise<{ familyId: string; userId: string } | null> {
    const refreshToken = readCookie(request, COOKIE_REFRESH);
    const stored = refreshToken
      ? await this.sessions.findFamily(refreshToken)
      : null;
    if (stored) {
      return { familyId: stored.familyId, userId: stored.userId };
    }
    const access = this.tokens.verify(
      'access',
      readCookie(request, COOKIE_ACCESS),
    );
    return access ? { familyId: access.fam, userId: access.sub } : null;
  }
}
