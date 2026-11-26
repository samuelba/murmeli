import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { requestMeta } from '../../../common/http/request-meta';
import { AuthThrottle } from '../../../throttler/auth-throttle.decorator';
import type { UserView } from '../../users/user.view';
import { AcceptInviteDto } from '../dto/auth.dto';
import { type InviteDetails, InviteService } from '../invites/invite.service';
import { SessionIssuer } from '../sessions/session-issuer';

@Public()
@AuthThrottle()
@Controller('invites')
export class InvitesController {
  constructor(
    private readonly invites: InviteService,
    private readonly issuer: SessionIssuer,
  ) {}

  @Get(':token')
  details(@Param('token') token: string): Promise<InviteDetails> {
    return this.invites.details(token);
  }

  @Post(':token/accept')
  @HttpCode(201)
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserView }> {
    const created = await this.invites.accept(token, dto.password, dto.locale);
    const user = await this.issuer.signIn(
      response,
      created,
      requestMeta(request),
      'invite',
    );
    return { user };
  }
}
