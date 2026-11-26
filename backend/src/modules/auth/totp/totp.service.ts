import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { toDataURL } from 'qrcode';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import type { VersionedCipher } from '../../../common/crypto/versioned-cipher';
import {
  RetryAfterException,
  apiError,
} from '../../../common/errors/api-exception';
import type { Env } from '../../../config/env.schema';
import { AuditService } from '../../audit/audit.service';
import { UserEntity } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import { TotpSecretEntity } from '../entities/totp-secret.entity';
import { AttemptLimiter } from '../limits/attempt-limiter.service';
import { LimitPolicies } from '../limits/limit-policies';
import { PasswordService } from '../passwords/password.service';
import { RecoveryCodeService } from './recovery-code.service';
import { createTotpCipher } from './totp-cipher';
import { createTotpSecret, matchingStep, otpauthUrl } from './totp-codes';

export const TOTP_INVALID = 'TOTP_INVALID';

export interface TotpSetup {
  readonly otpauthUrl: string;
  readonly qrDataUrl: string;
}

export interface TotpActor {
  readonly userId: string;
  readonly ip: string | null;
}

function invalidCode() {
  return apiError(HttpStatus.UNAUTHORIZED, TOTP_INVALID, 'Invalid code');
}

/**
 * TOTP (RFC 6238, 6 digits, 30 s) with the secret encrypted at rest. Each
 * time step is accepted once per user, so a code cannot be replayed.
 */
@Injectable()
export class TotpService {
  private readonly cipher: VersionedCipher;

  constructor(
    @InjectRepository(TotpSecretEntity)
    private readonly secrets: Repository<TotpSecretEntity>,
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly recoveryCodes: RecoveryCodeService,
    private readonly audit: AuditService,
    private readonly limiter: AttemptLimiter,
    private readonly policies: LimitPolicies,
    config: ConfigService<Env, true>,
  ) {
    this.cipher = createTotpCipher(
      config.get('ENCRYPTION_KEY', { infer: true }),
    );
  }

  async setup(userId: string): Promise<TotpSetup> {
    const user = await this.requireUser(userId);
    if (user.totpEnabled) {
      throw apiError(
        HttpStatus.CONFLICT,
        'TOTP_ALREADY_ENABLED',
        'Two-factor authentication is already enabled',
      );
    }
    const secret = createTotpSecret();
    await this.secrets.upsert(
      {
        userId,
        secretEncrypted: this.cipher.encrypt(secret, userId),
        confirmedAt: null,
        lastUsedStep: null,
      },
      ['userId'],
    );
    const url = otpauthUrl(secret, user.email);
    return { otpauthUrl: url, qrDataUrl: await toDataURL(url) };
  }

  async enable(actor: TotpActor, code: string): Promise<string[]> {
    const valid = await this.checkWithLimit(actor.userId, () =>
      this.consumeCode(actor.userId, code, false),
    );
    if (!valid) {
      throw invalidCode();
    }
    const codes = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        TotpSecretEntity,
        { userId: actor.userId },
        { confirmedAt: new Date() },
      );
      await manager.update(
        UserEntity,
        { id: actor.userId },
        { totpEnabled: true },
      );
      return this.recoveryCodes.replace(actor.userId, manager);
    });
    await this.recordAudit('auth.totp_enabled', actor);
    return codes;
  }

  async disable(
    actor: TotpActor,
    password: string,
    code: string,
  ): Promise<void> {
    const user = await this.requireUser(actor.userId);
    if (!(await this.passwords.verify(password, user.passwordHash))) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid credentials',
      );
    }
    const valid =
      user.totpEnabled &&
      (await this.checkWithLimit(user.id, () =>
        this.verifyAnyCode(user.id, code),
      ));
    if (!valid) {
      throw invalidCode();
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TotpSecretEntity, { userId: user.id });
      await this.recoveryCodes.removeAll(user.id, manager);
      await manager.update(UserEntity, { id: user.id }, { totpEnabled: false });
    });
    await this.recordAudit('auth.totp_disabled', actor);
  }

  async regenerateRecoveryCodes(
    userId: string,
    code: string,
  ): Promise<string[]> {
    const valid = await this.checkWithLimit(userId, () =>
      this.consumeCode(userId, code, true),
    );
    if (!valid) {
      throw invalidCode();
    }
    return this.recoveryCodes.replace(userId);
  }

  /**
   * Runs a code check under the per-user TOTP limit, which spans sign-ins
   * and the TOTP settings and is only reset by a correct code.
   * @throws 429 RATE_LIMITED while the user's TOTP checks are locked
   */
  async checkWithLimit(
    userId: string,
    check: () => Promise<boolean>,
  ): Promise<boolean> {
    const attempt = await this.limiter.attempt(this.policies.totpUser, userId);
    if (!attempt.allowed) {
      throw new RetryAfterException(attempt.retryAfterSeconds);
    }
    const valid = await check();
    if (valid) {
      await this.limiter.succeed(this.policies.totpUser, userId);
    }
    return valid;
  }

  /**
   * Accepts a TOTP code or an unused recovery code.
   */
  async verifyAnyCode(userId: string, code: string): Promise<boolean> {
    return (
      (await this.consumeCode(userId, code, true)) ||
      (await this.recoveryCodes.consume(userId, code))
    );
  }

  /**
   * Validates a code against the stored secret and records its time step,
   * atomically, so the same code is never accepted twice.
   */
  async consumeCode(
    userId: string,
    code: string,
    confirmed: boolean,
  ): Promise<boolean> {
    const stored = await this.secrets.findOneBy({
      userId,
      confirmedAt: confirmed ? Not(IsNull()) : IsNull(),
    });
    if (!stored) {
      return false;
    }
    const step = matchingStep(
      this.cipher.decrypt(stored.secretEncrypted, userId),
      code,
    );
    if (step === null) {
      return false;
    }
    const rows = await this.dataSource.query<[unknown[], number]>(
      `UPDATE "totp_secrets" SET "last_used_step" = $2, "updated_at" = now()
       WHERE "user_id" = $1 AND ("last_used_step" IS NULL OR "last_used_step" < $2)
         AND ("confirmed_at" IS NOT NULL) = $3
       RETURNING "user_id"`,
      [userId, step, confirmed],
    );
    return rows[1] === 1;
  }

  private async requireUser(userId: string): Promise<UserEntity> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Sign-in required',
      );
    }
    return user;
  }

  private recordAudit(
    action: 'auth.totp_enabled' | 'auth.totp_disabled',
    actor: TotpActor,
  ): Promise<void> {
    return this.audit.record({
      action,
      actorId: actor.userId,
      targetType: 'user',
      targetId: actor.userId,
      ip: actor.ip,
    });
  }
}
