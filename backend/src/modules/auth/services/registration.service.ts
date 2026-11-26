import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { apiError } from '../../../common/errors/api-exception';
import type { RequestMeta } from '../../../common/http/request-meta';
import { AltchaService } from '../../altcha/altcha.service';
import { AuditService } from '../../audit/audit.service';
import { SettingsService } from '../../settings/settings.service';
import { UserEntity } from '../../users/user.entity';
import { UsersService, isUniqueViolation } from '../../users/users.service';
import type { EmailWithAltchaDto, RegisterDto } from '../dto/auth.dto';
import type { EmailTokenType } from '../entities/email-token.entity';
import { PasswordService } from '../passwords/password.service';
import { AuthMailer } from './auth-mailer';
import { EmailTokenService } from './email-token.service';

interface VerifyOutcome {
  readonly type: VerifiedType;
  /** The user as before the change (old address for email changes) */
  readonly user: UserEntity;
}

export type VerifiedType = Extract<
  EmailTokenType,
  'registration' | 'email_change'
>;

export const TOKEN_INVALID = 'TOKEN_INVALID';

export function tokenInvalid() {
  return apiError(
    HttpStatus.BAD_REQUEST,
    TOKEN_INVALID,
    'The link is invalid or has expired',
  );
}

/**
 * Self-registration, email verification and resending the verification.
 * Responses are the same whether or not the address already has an account.
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly settings: SettingsService,
    private readonly altcha: AltchaService,
    private readonly emailTokens: EmailTokenService,
    private readonly mailer: AuthMailer,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    if (!(await this.settings.isRegistrationEnabled())) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'REGISTRATION_DISABLED',
        'Registration is disabled',
      );
    }
    await this.altcha.assertValid(dto.altcha);
    await this.passwords.assertAcceptable(dto.password);
    const passwordHash = await this.passwords.hash(dto.password);

    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      await this.mailer.accountExists({
        email: existing.email,
        locale: dto.locale,
      });
      return;
    }
    try {
      const user = await this.users.create({
        email: dto.email,
        passwordHash,
        locale: dto.locale,
      });
      await this.sendVerification(user);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      this.logger.warn('Concurrent registration of the same address');
      await this.mailer.accountExists({ email: dto.email, locale: dto.locale });
    }
  }

  async resendVerification(dto: EmailWithAltchaDto): Promise<void> {
    await this.altcha.assertValid(dto.altcha);
    const user = await this.users.findByEmail(dto.email);
    if (user && user.emailVerifiedAt === null && !user.disabled) {
      await this.sendVerification(user);
    }
  }

  async resendForUser(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw apiError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
    }
    if (user.emailVerifiedAt === null) {
      await this.sendVerification(user);
    }
  }

  async verifyEmail(token: string, meta: RequestMeta): Promise<VerifiedType> {
    let outcome: VerifyOutcome;
    try {
      outcome = await this.dataSource.transaction((manager) =>
        this.applyToken(manager, token),
      );
    } catch (error) {
      throw isUniqueViolation(error) ? tokenInvalid() : error;
    }
    if (outcome.type === 'email_change') {
      await this.audit.record({
        action: 'auth.email_changed',
        actorId: outcome.user.id,
        targetType: 'user',
        targetId: outcome.user.id,
        ip: meta.ip,
      });
      await this.mailer.emailChanged({
        email: outcome.user.email,
        locale: outcome.user.locale,
      });
    }
    return outcome.type;
  }

  /**
   * Consumes the token and applies it in the same transaction. An email
   * change also invalidates the user's other open email tokens.
   */
  private async applyToken(
    manager: EntityManager,
    token: string,
  ): Promise<VerifyOutcome> {
    const consumed = await this.emailTokens.consume(
      token,
      ['registration', 'email_change'],
      manager,
    );
    const users = manager.getRepository(UserEntity);
    const user = consumed
      ? await users.findOneBy({ id: consumed.userId })
      : null;
    if (!consumed || !user) {
      throw tokenInvalid();
    }
    if (consumed.type === 'registration') {
      await users.update(
        { id: user.id },
        { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      );
      return { type: 'registration', user };
    }
    await users.update(
      { id: user.id },
      { email: consumed.newEmail ?? '', emailVerifiedAt: new Date() },
    );
    await this.emailTokens.invalidateAll(user.id, manager);
    return { type: 'email_change', user };
  }

  private async sendVerification(user: UserEntity): Promise<void> {
    const token = await this.emailTokens.issue(user.id, 'registration');
    await this.mailer.verifyEmail(
      { email: user.email, locale: user.locale },
      token,
    );
  }
}
