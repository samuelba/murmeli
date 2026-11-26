import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { apiError } from '../../common/errors/api-exception';
import type { RequestMeta } from '../../common/http/request-meta';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PasswordService } from '../auth/passwords/password.service';
import { AuthMailer } from '../auth/services/auth-mailer';
import { EmailTokenService } from '../auth/services/email-token.service';
import { invalidCredentials } from '../auth/services/login.service';
import { SessionService } from '../auth/sessions/session.service';
import { KidsService } from '../kids/kids.service';
import type { KidView } from '../kids/kid.types';
import {
  type KidProgressExport,
  ProgressExportService,
} from '../learning/progress/progress-export.service';
import { deleteUserIn } from '../users/user-deletion';
import { UserGuardrail } from '../users/user-guardrail.service';
import { UserEntity } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { type UserView, toUserView } from '../users/user.view';
import type {
  ChangeEmailDto,
  ChangePasswordDto,
  UpdateAccountDto,
} from './account.dto';

export interface AccountExport {
  readonly exportedAt: string;
  readonly user: UserView & { readonly lastLoginAt: string | null };
  readonly kids: readonly KidView[];
  readonly progress: readonly KidProgressExport[];
}

/**
 * The signed-in parent's own account: password, email, preferences, data
 * export and deletion.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly emailTokens: EmailTokenService,
    private readonly mailer: AuthMailer,
    private readonly kids: KidsService,
    private readonly audit: AuditService,
    private readonly guardrail: UserGuardrail,
    private readonly dataSource: DataSource,
    private readonly progressExport: ProgressExportService,
  ) {}

  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.verifiedUser(auth.userId, dto.currentPassword);
    await this.passwords.assertAcceptable(dto.newPassword);
    const passwordHash = await this.passwords.hash(dto.newPassword);
    const families = await this.dataSource.transaction(async (manager) => {
      await manager.update(UserEntity, { id: user.id }, { passwordHash });
      await this.emailTokens.invalidateAll(user.id, manager);
      return this.sessions.revokeUserSessionsIn(
        manager,
        user.id,
        'password_changed',
        auth.familyId,
      );
    });
    await this.sessions.markRevoked(families);
    await this.audit.record({
      action: 'auth.password_changed',
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      ip: meta.ip,
    });
    await this.mailer.passwordChanged({
      email: user.email,
      locale: user.locale,
    });
  }

  async requestEmailChange(
    auth: AuthContext,
    dto: ChangeEmailDto,
  ): Promise<void> {
    const user = await this.verifiedUser(auth.userId, dto.password);
    if (await this.users.findByEmail(dto.newEmail)) {
      return;
    }
    const token = await this.emailTokens.issue(
      user.id,
      'email_change',
      dto.newEmail,
    );
    await this.mailer.emailChange(
      { email: dto.newEmail, locale: user.locale },
      token,
    );
  }

  async updatePreferences(
    userId: string,
    dto: UpdateAccountDto,
  ): Promise<UserView> {
    const changes = {
      ...(dto.locale !== undefined && { locale: dto.locale }),
      ...(dto.theme !== undefined && { theme: dto.theme }),
    };
    const user =
      Object.keys(changes).length > 0
        ? await this.users.update(userId, changes)
        : await this.users.findById(userId);
    return toUserView(this.require(user));
  }

  async export(userId: string): Promise<AccountExport> {
    const user = this.require(await this.users.findById(userId));
    const kids = await this.kids.list(userId);
    return {
      exportedAt: new Date().toISOString(),
      user: {
        ...toUserView(user),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
      kids,
      progress: await this.progressExport.forKids(kids.map((kid) => kid.id)),
    };
  }

  /**
   * Hard-deletes the account. The audit entry carries no reference to the
   * deleted user, and their earlier entries are anonymised.
   */
  async delete(auth: AuthContext, password: string): Promise<void> {
    const user = await this.verifiedUser(auth.userId, password);
    const families = await this.guardrail.mutate(
      user.id,
      () => true,
      async (manager) => {
        const revoked = await this.sessions.revokeUserSessionsIn(
          manager,
          user.id,
          'deleted',
        );
        await deleteUserIn(manager, user.id);
        return revoked;
      },
    );
    await this.sessions.markRevoked(families);
    await this.audit.record({ action: 'account.deleted', targetType: 'user' });
  }

  private async verifiedUser(
    userId: string,
    password: string,
  ): Promise<UserEntity> {
    const user = this.require(await this.users.findById(userId));
    if (!(await this.passwords.verify(password, user.passwordHash))) {
      throw invalidCredentials();
    }
    return user;
  }

  private require(user: UserEntity | null): UserEntity {
    if (!user) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Sign-in required',
      );
    }
    return user;
  }
}
