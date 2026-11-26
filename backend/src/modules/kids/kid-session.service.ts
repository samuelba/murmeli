import { HttpStatus, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  RetryAfterException,
  apiError,
} from '../../common/errors/api-exception';
import { AuditService } from '../audit/audit.service';
import { COOKIE_KID, KID_SESSION_TTL_SECONDS } from '../auth/auth.constants';
import type { AuthContext } from '../auth/auth.types';
import { AuthCookies, readCookie } from '../auth/cookies/auth-cookies';
import { AttemptLimiter } from '../auth/limits/attempt-limiter.service';
import { LimitPolicies } from '../auth/limits/limit-policies';
import { PasswordService } from '../auth/passwords/password.service';
import { SessionIssuer } from '../auth/sessions/session-issuer';
import { TokenService } from '../auth/tokens/token.service';
import type { KidEntity } from './kid.entity';
import type { KidView } from './kid.types';
import { toKidView } from './kid.view';
import { KidsService, pinToSecret } from './kids.service';

export const PIN_LOCKED = 'PIN_LOCKED';

function pinLocked(retryAfterSeconds: number) {
  return new RetryAfterException(
    retryAfterSeconds,
    PIN_LOCKED,
    'Too many wrong PINs, the profile is locked for a while',
  );
}

/**
 * Switching the device to a kid: checks the picture PIN (with exponential
 * lockout per kid), sets `mu_kid` and locks the parent gate.
 */
@Injectable()
export class KidSessionService {
  constructor(
    private readonly kids: KidsService,
    private readonly passwords: PasswordService,
    private readonly limiter: AttemptLimiter,
    private readonly policies: LimitPolicies,
    private readonly tokens: TokenService,
    private readonly cookies: AuthCookies,
    private readonly issuer: SessionIssuer,
    private readonly audit: AuditService,
  ) {}

  async activate(
    auth: AuthContext,
    kidId: string,
    pin: number[] | undefined,
    response: Response,
    ip: string | null,
  ): Promise<KidView> {
    const kid = await this.kids.requireOwned(auth.userId, kidId);
    if (kid.pinHash !== null) {
      await this.checkPin(kid, kid.pinHash, pin, auth.userId, ip);
    }
    const session = this.tokens.sign(
      'kid',
      { sub: auth.userId, kid: kid.id, fam: auth.familyId },
      KID_SESSION_TTL_SECONDS,
    );
    this.cookies.set(response, COOKIE_KID, session.token, session.expiresAt);
    this.issuer.closeParentGate(response);
    await this.kids.markActive(kid.id);
    return toKidView(kid);
  }

  deactivate(response: Response): void {
    this.cookies.clear(response, COOKIE_KID);
  }

  /**
   * The kid of a valid `mu_kid` bound to this user and refresh family.
   */
  async activeKid(
    request: Request,
    auth: AuthContext,
  ): Promise<KidEntity | null> {
    const claims = this.tokens.verify('kid', readCookie(request, COOKIE_KID));
    if (!claims || claims.sub !== auth.userId || claims.fam !== auth.familyId) {
      return null;
    }
    return this.kids.findOwned(auth.userId, claims.kid);
  }

  private async checkPin(
    kid: KidEntity,
    pinHash: string,
    pin: number[] | undefined,
    userId: string,
    ip: string | null,
  ): Promise<void> {
    const attempt = await this.limiter.attempt(this.policies.kidPin, kid.id);
    if (attempt.justLocked) {
      await this.audit.record({
        action: 'kid.pin_locked',
        actorId: userId,
        targetType: 'kid',
        targetId: kid.id,
        ip,
        meta: { lockSeconds: attempt.retryAfterSeconds },
      });
    }
    if (!attempt.allowed) {
      throw pinLocked(attempt.retryAfterSeconds);
    }
    if (pin && (await this.passwords.verify(pinToSecret(pin), pinHash))) {
      await this.limiter.succeed(this.policies.kidPin, kid.id);
      return;
    }
    throw apiError(HttpStatus.UNAUTHORIZED, 'PIN_INVALID', 'Wrong PIN');
  }
}
