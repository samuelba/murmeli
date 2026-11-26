import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { RetryAfterException } from '../../../common/errors/api-exception';
import { UsersService } from '../../users/users.service';
import type { AuthContext } from '../auth.types';
import { AttemptLimiter } from '../limits/attempt-limiter.service';
import { LimitPolicies } from '../limits/limit-policies';
import { PasswordService } from '../passwords/password.service';
import { SessionIssuer } from '../sessions/session-issuer';
import { invalidCredentials } from './login.service';

@Injectable()
export class ParentGateService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly limiter: AttemptLimiter,
    private readonly policies: LimitPolicies,
    private readonly issuer: SessionIssuer,
  ) {}

  async unlock(
    auth: AuthContext,
    password: string,
    response: Response,
  ): Promise<Date> {
    const attempt = await this.limiter.attempt(
      this.policies.parentGate,
      auth.userId,
    );
    if (!attempt.allowed) {
      throw new RetryAfterException(attempt.retryAfterSeconds);
    }
    const user = await this.users.findById(auth.userId);
    if (!user || !(await this.passwords.verify(password, user.passwordHash))) {
      throw invalidCredentials();
    }
    await this.limiter.succeed(this.policies.parentGate, auth.userId);
    return this.issuer.openParentGate(response, auth.userId, auth.familyId);
  }

  lock(response: Response): void {
    this.issuer.closeParentGate(response);
  }
}
