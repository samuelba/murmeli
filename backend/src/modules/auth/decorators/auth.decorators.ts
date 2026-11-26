import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext, AuthenticatedRequest } from '../auth.types';
import { AdminGuard } from '../guards/admin.guard';
import { ParentGateGuard } from '../guards/parent-gate.guard';
import { requireAuth } from '../guards/require-auth';

export function currentAuth(context: ExecutionContext): AuthContext {
  return requireAuth(context.switchToHttp().getRequest<AuthenticatedRequest>());
}

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext =>
    currentAuth(context),
);

export const RequireParentGate = () =>
  applyDecorators(UseGuards(ParentGateGuard));

export const AdminOnly = () =>
  applyDecorators(UseGuards(AdminGuard, ParentGateGuard));
