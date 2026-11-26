import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { RequestMeta } from '../../../common/http/request-meta';
import { AltchaService } from '../../altcha/altcha.service';
import { AuditService } from '../../audit/audit.service';
import { UserEntity } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import type { EmailWithAltchaDto, ResetPasswordDto } from '../dto/auth.dto';
import { PasswordService } from '../passwords/password.service';
import { SessionService } from '../sessions/session.service';
import { AuthMailer } from './auth-mailer';
import { EmailTokenService } from './email-token.service';
import { tokenInvalid } from './registration.service';

/**
 * Forgot / reset password. The request always looks the same; a reset signs
 * the user out everywhere and also counts as email verification.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly altcha: AltchaService,
    private readonly emailTokens: EmailTokenService,
    private readonly mailer: AuthMailer,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async requestReset(dto: EmailWithAltchaDto): Promise<void> {
    await this.altcha.assertValid(dto.altcha);
    const user = await this.users.findByEmail(dto.email);
    if (user && !user.disabled) {
      const token = await this.emailTokens.issue(user.id, 'password_reset');
      await this.mailer.passwordReset(
        { email: user.email, locale: user.locale },
        token,
      );
    }
  }

  async reset(dto: ResetPasswordDto, meta: RequestMeta): Promise<void> {
    await this.passwords.assertAcceptable(dto.password);
    const passwordHash = await this.passwords.hash(dto.password);
    const { user, families } = await this.dataSource.transaction(
      async (manager) => {
        const consumed = await this.emailTokens.consume(
          dto.token,
          ['password_reset'],
          manager,
        );
        const users = manager.getRepository(UserEntity);
        const found = consumed
          ? await users.findOneBy({ id: consumed.userId })
          : null;
        if (!found || found.disabled) {
          throw tokenInvalid();
        }
        await users.update(
          { id: found.id },
          {
            passwordHash,
            emailVerifiedAt: found.emailVerifiedAt ?? new Date(),
          },
        );
        await this.emailTokens.invalidateAll(found.id, manager);
        const revoked = await this.sessions.revokeUserSessionsIn(
          manager,
          found.id,
          'password_reset',
        );
        return { user: found, families: revoked };
      },
    );
    await this.sessions.markRevoked(families);
    await this.audit.record({
      action: 'auth.password_reset',
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
}
