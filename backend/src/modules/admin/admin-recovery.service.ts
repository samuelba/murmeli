import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { apiError } from '../../common/errors/api-exception';
import { AuditService } from '../audit/audit.service';
import { AuthMailer } from '../auth/services/auth-mailer';
import { EmailTokenService } from '../auth/services/email-token.service';
import { userNotFound } from '../users/user-guardrail.service';
import { UserEntity } from '../users/user.entity';
import {
  type AdminActor,
  type AdminUserView,
  AdminUsersService,
} from './admin-users.service';

export interface PasswordResetLink {
  readonly resetUrl: string;
  readonly expiresAt: string;
}

/**
 * Helps a parent who cannot receive email: an admin can hand over a reset
 * link or confirm the address by hand. The link is a normal single-use
 * password_reset token; no email is sent.
 */
@Injectable()
export class AdminRecoveryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly emailTokens: EmailTokenService,
    private readonly mailer: AuthMailer,
    private readonly audit: AuditService,
    private readonly adminUsers: AdminUsersService,
  ) {}

  async passwordResetLink(
    actor: AdminActor,
    id: string,
  ): Promise<PasswordResetLink> {
    const user = await this.dataSource
      .getRepository(UserEntity)
      .findOneBy({ id });
    if (!user) {
      throw userNotFound();
    }
    if (user.disabled) {
      throw apiError(
        HttpStatus.CONFLICT,
        'USER_DISABLED',
        'A disabled user cannot reset the password',
      );
    }
    const { token, expiresAt } = await this.emailTokens.issueWithExpiry(
      id,
      'password_reset',
    );
    await this.audit.record({
      action: 'admin.password_reset_link_created',
      actorId: actor.userId,
      targetType: 'user',
      targetId: id,
      ip: actor.ip,
    });
    return {
      resetUrl: this.mailer.passwordResetUrl(token),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** Idempotent; only an actual change is audited. */
  async verifyEmail(actor: AdminActor, id: string): Promise<AdminUserView> {
    const changed = await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const user = await users.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw userNotFound();
      }
      if (user.emailVerifiedAt !== null) {
        return false;
      }
      await users.update({ id }, { emailVerifiedAt: new Date() });
      await this.emailTokens.invalidate(id, 'registration', manager);
      return true;
    });
    if (changed) {
      await this.audit.record({
        action: 'admin.email_verified',
        actorId: actor.userId,
        targetType: 'user',
        targetId: id,
        ip: actor.ip,
      });
    }
    return this.adminUsers.view(id);
  }
}
