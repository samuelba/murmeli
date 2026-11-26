import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { apiError } from '../../../common/errors/api-exception';
import { SettingsService } from '../../settings/settings.service';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedRequest } from '../auth.types';
import { requireAuth } from './require-auth';

export const TOTP_REQUIRED = 'TOTP_REQUIRED';

/**
 * Checks the role against the database, so a demoted or disabled admin loses
 * access at once. With `require_admin_totp` on, admins without TOTP get
 * 403 TOTP_REQUIRED; the TOTP setup routes are not admin routes and stay open.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly users: UsersService,
    private readonly settings: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const auth = requireAuth(
      context.switchToHttp().getRequest<AuthenticatedRequest>(),
    );
    const user = await this.users.findById(auth.userId);
    if (!user || user.disabled || user.role !== 'admin') {
      throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Admins only');
    }
    if (!user.totpEnabled && (await this.settings.isAdminTotpRequired())) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        TOTP_REQUIRED,
        'Admins must enable two-factor authentication first',
      );
    }
    return true;
  }
}
