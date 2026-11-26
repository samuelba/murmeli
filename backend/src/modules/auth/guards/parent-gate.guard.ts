import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { apiError } from '../../../common/errors/api-exception';
import { COOKIE_PARENT_GATE } from '../auth.constants';
import type { AuthenticatedRequest } from '../auth.types';
import { readCookie } from '../cookies/auth-cookies';
import { SessionIssuer } from '../sessions/session-issuer';
import { TokenService } from '../tokens/token.service';
import { requireAuth } from './require-auth';

export const PARENT_GATE_REQUIRED = 'PARENT_GATE_REQUIRED';

/**
 * Parent-area routes need an unlocked parent gate (`mu_pg`) bound to the same
 * user and refresh family as the session. Each gated request renews the gate
 * for another ten minutes, up to thirty minutes after the password was
 * entered.
 */
@Injectable()
export class ParentGateGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly issuer: SessionIssuer,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const auth = requireAuth(request);
    const claims = this.tokens.verify(
      'parent_gate',
      readCookie(request, COOKIE_PARENT_GATE),
    );
    if (!claims || claims.sub !== auth.userId || claims.fam !== auth.familyId) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        PARENT_GATE_REQUIRED,
        'The parent gate is locked',
      );
    }
    this.issuer.openParentGate(
      http.getResponse<Response>(),
      auth.userId,
      auth.familyId,
      claims.ath,
    );
    return true;
  }
}
