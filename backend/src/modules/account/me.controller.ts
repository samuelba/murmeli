import { Controller, Get, HttpStatus, Req } from '@nestjs/common';
import type { Request } from 'express';
import { apiError } from '../../common/errors/api-exception';
import { COOKIE_PARENT_GATE } from '../auth/auth.constants';
import type { AuthContext } from '../auth/auth.types';
import { readCookie } from '../auth/cookies/auth-cookies';
import { CurrentAuth } from '../auth/decorators/auth.decorators';
import { TokenService } from '../auth/tokens/token.service';
import { KidSessionService } from '../kids/kid-session.service';
import type { KidView } from '../kids/kid.types';
import { toKidView } from '../kids/kid.view';
import { UsersService } from '../users/users.service';
import { type UserView, toUserView } from '../users/user.view';

export interface MeView {
  readonly user: UserView;
  readonly parentGateExpiresAt: string | null;
  readonly activeKid: KidView | null;
}

@Controller('auth/me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly kidSessions: KidSessionService,
  ) {}

  @Get()
  async me(
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ): Promise<MeView> {
    const user = await this.users.findById(auth.userId);
    if (!user || user.disabled) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Sign-in required',
      );
    }
    const kid = await this.kidSessions.activeKid(request, auth);
    return {
      user: toUserView(user),
      parentGateExpiresAt: this.parentGateExpiry(request, auth),
      activeKid: kid ? toKidView(kid) : null,
    };
  }

  private parentGateExpiry(request: Request, auth: AuthContext): string | null {
    const gate = this.tokens.verify(
      'parent_gate',
      readCookie(request, COOKIE_PARENT_GATE),
    );
    return gate && gate.sub === auth.userId && gate.fam === auth.familyId
      ? new Date(gate.exp * 1000).toISOString()
      : null;
  }
}
