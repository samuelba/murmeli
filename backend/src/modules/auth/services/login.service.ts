import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  RetryAfterException,
  apiError,
} from '../../../common/errors/api-exception';
import { sha256Hex } from '../../../common/crypto/secure-token';
import type { RequestMeta } from '../../../common/http/request-meta';
import { AuditService } from '../../audit/audit.service';
import { rateLimitNetwork } from '../../audit/truncate-ip';
import type { UserEntity } from '../../users/user.entity';
import { UsersService, normalizeEmail } from '../../users/users.service';
import type { UserView } from '../../users/user.view';
import { COOKIE_TOTP, TOTP_STEP_TTL_SECONDS } from '../auth.constants';
import { AuthCookies, readCookie } from '../cookies/auth-cookies';
import type { LoginDto, TotpVerifyDto } from '../dto/auth.dto';
import { AttemptLimiter } from '../limits/attempt-limiter.service';
import { LimitPolicies } from '../limits/limit-policies';
import { PasswordService } from '../passwords/password.service';
import { SessionIssuer } from '../sessions/session-issuer';
import { TokenService } from '../tokens/token.service';
import { RecoveryCodeService } from '../totp/recovery-code.service';
import { TOTP_INVALID, TotpService } from '../totp/totp.service';

export type LoginResult =
  { readonly user: UserView } | { readonly totpRequired: true };

export const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS';

export function invalidCredentials() {
  return apiError(
    HttpStatus.UNAUTHORIZED,
    INVALID_CREDENTIALS,
    'Invalid email or password',
  );
}

export function accountKey(email: string): string {
  return sha256Hex(normalizeEmail(email).toLowerCase());
}

export function accountNetworkKey(email: string, ip: string | null): string {
  return sha256Hex(
    `${normalizeEmail(email).toLowerCase()}|${rateLimitNetwork(ip)}`,
  );
}

function totpInvalid() {
  return apiError(HttpStatus.UNAUTHORIZED, TOTP_INVALID, 'Invalid code');
}

/**
 * Password sign-in and the TOTP second step. Failures are limited per email
 * and client network (strict) and per email overall (loose ceiling), for
 * existing and unknown addresses alike; unknown addresses still pay for a
 * password hash, so responses do not reveal which accounts exist.
 */
@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly limiter: AttemptLimiter,
    private readonly policies: LimitPolicies,
    private readonly issuer: SessionIssuer,
    private readonly tokens: TokenService,
    private readonly cookies: AuthCookies,
    private readonly totp: TotpService,
    private readonly recoveryCodes: RecoveryCodeService,
    private readonly audit: AuditService,
  ) {}

  async login(
    dto: LoginDto,
    meta: RequestMeta,
    response: Response,
  ): Promise<LoginResult> {
    const pairKey = accountNetworkKey(dto.email, meta.ip);
    const emailKey = accountKey(dto.email);
    await this.reserveLoginAttempt(pairKey, emailKey, meta);

    const user = await this.users.findByEmail(dto.email);
    const valid = user
      ? await this.passwords.verify(dto.password, user.passwordHash)
      : await this.passwords.verifyDummy(dto.password);
    if (!user || !valid) {
      await this.audit.record({
        action: 'auth.login_failed',
        actorId: user?.id ?? null,
        ...(user && { targetType: 'user' as const, targetId: user.id }),
        ip: meta.ip,
      });
      throw invalidCredentials();
    }

    await this.limiter.succeed(this.policies.login, pairKey);
    await this.limiter.succeed(this.policies.loginEmail, emailKey);
    this.assertCanSignIn(user);
    if (user.totpEnabled) {
      this.startTotpStep(response, user.id);
      return { totpRequired: true };
    }
    return { user: await this.issuer.signIn(response, user, meta, 'password') };
  }

  async verifyTotp(
    dto: TotpVerifyDto,
    meta: RequestMeta,
    request: Request,
    response: Response,
  ): Promise<{ user: UserView }> {
    const claims = this.tokens.verify('totp', readCookie(request, COOKIE_TOTP));
    if (!claims) {
      throw apiError(HttpStatus.UNAUTHORIZED, TOTP_INVALID, 'Sign in again');
    }
    const attempt = await this.limiter.attempt(this.policies.totp, claims.jti);
    if (!attempt.allowed) {
      this.cookies.clear(response, COOKIE_TOTP);
      throw new RetryAfterException(attempt.retryAfterSeconds);
    }

    const user = await this.users.findById(claims.sub);
    if (!user || user.disabled || !user.totpEnabled) {
      throw totpInvalid();
    }
    const method = dto.recoveryCode !== undefined ? 'recovery_code' : 'totp';
    const valid = await this.totp.checkWithLimit(user.id, () =>
      method === 'totp'
        ? this.totp.consumeCode(user.id, dto.code ?? '', true)
        : this.recoveryCodes.consume(user.id, dto.recoveryCode ?? ''),
    );
    if (!valid) {
      throw totpInvalid();
    }
    return { user: await this.issuer.signIn(response, user, meta, method) };
  }

  private async reserveLoginAttempt(
    pairKey: string,
    emailKey: string,
    meta: RequestMeta,
  ): Promise<void> {
    const pair = await this.limiter.attempt(this.policies.login, pairKey);
    const email = await this.limiter.attempt(
      this.policies.loginEmail,
      emailKey,
    );
    if (email.justLocked) {
      this.logger.warn(
        `Sign-in ceiling reached for address ${emailKey.slice(0, 12)}, locked for ${email.retryAfterSeconds} s`,
      );
      await this.audit.record({
        action: 'auth.login_failed',
        ip: meta.ip,
        meta: { lockedAddress: true },
      });
    }
    if (!pair.allowed || !email.allowed) {
      throw new RetryAfterException(
        Math.max(pair.retryAfterSeconds, email.retryAfterSeconds),
      );
    }
  }

  private assertCanSignIn(user: UserEntity): void {
    if (user.disabled) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_DISABLED',
        'This account is disabled',
      );
    }
    if (user.emailVerifiedAt === null) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'EMAIL_NOT_VERIFIED',
        'The email address is not verified yet',
      );
    }
  }

  private startTotpStep(response: Response, userId: string): void {
    const step = this.tokens.sign(
      'totp',
      this.tokens.newTotpClaims(userId),
      TOTP_STEP_TTL_SECONDS,
    );
    this.cookies.set(response, COOKIE_TOTP, step.token, step.expiresAt);
  }
}
