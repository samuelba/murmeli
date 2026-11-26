import { HttpStatus } from '@nestjs/common';
import { apiError } from '../../../common/errors/api-exception';
import type { AuthContext, AuthenticatedRequest } from '../auth.types';

export function requireAuth(request: AuthenticatedRequest): AuthContext {
  if (!request.auth) {
    throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Sign-in required');
  }
  return request.auth;
}
