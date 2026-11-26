import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { apiError } from '../../../common/errors/api-exception';
import { COOKIE_ACCESS } from '../auth.constants';
import type { AuthenticatedRequest } from '../auth.types';
import { readCookie } from '../cookies/auth-cookies';
import { SessionService } from '../sessions/session.service';
import { TokenService } from '../tokens/token.service';

export const SESSION_EXPIRED = 'SESSION_EXPIRED';
export const UNAUTHORIZED = 'UNAUTHORIZED';

/**
 * Global and deny-by-default: every route needs a valid `mu_at` whose refresh
 * family is still active, unless it is marked `@Public()`. A missing, expired
 * or revoked access token is 401 UNAUTHORIZED, which tells the frontend to
 * try a refresh.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const claims = this.tokens.verify(
      'access',
      readCookie(request, COOKIE_ACCESS),
    );
    if (!claims || !(await this.sessions.isFamilyActive(claims.fam))) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        UNAUTHORIZED,
        'Sign-in required or the session has expired',
      );
    }
    request.auth = { userId: claims.sub, familyId: claims.fam };
    return true;
  }
}
