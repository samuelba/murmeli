import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { apiError } from '../../common/errors/api-exception';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { requireAuth } from '../auth/guards/require-auth';
import type { KidEntity } from './kid.entity';
import { KidSessionService } from './kid-session.service';

export const KID_SESSION_REQUIRED = 'KID_SESSION_REQUIRED';

export interface KidRequest extends AuthenticatedRequest {
  kid?: KidEntity;
}

/**
 * Learning routes need an active kid (`mu_kid`) that belongs to the signed-in
 * parent and the current refresh family.
 */
@Injectable()
export class KidGuard implements CanActivate {
  constructor(private readonly kidSessions: KidSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<KidRequest>();
    const kid = await this.kidSessions.activeKid(request, requireAuth(request));
    if (!kid) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        KID_SESSION_REQUIRED,
        'Pick a kid profile first',
      );
    }
    request.kid = kid;
    return true;
  }
}
