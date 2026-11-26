import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { requestMeta } from '../../common/http/request-meta';
import { AuthThrottle } from '../../throttler/auth-throttle.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AuthCookies } from '../auth/cookies/auth-cookies';
import {
  CurrentAuth,
  RequireParentGate,
} from '../auth/decorators/auth.decorators';
import type { UserView } from '../users/user.view';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateAccountDto,
} from './account.dto';
import { type AccountExport, AccountService } from './account.service';

export const EXPORT_FILENAME = 'murmeli-export.json';

@RequireParentGate()
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly cookies: AuthCookies,
  ) {}

  @AuthThrottle()
  @Post('password')
  @HttpCode(200)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    await this.account.changePassword(auth, dto, requestMeta(request));
    return { ok: true };
  }

  @AuthThrottle()
  @Post('email')
  @HttpCode(202)
  async changeEmail(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ChangeEmailDto,
  ): Promise<{ ok: true }> {
    await this.account.requestEmailChange(auth, dto);
    return { ok: true };
  }

  @Patch()
  async update(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpdateAccountDto,
  ): Promise<{ user: UserView }> {
    return { user: await this.account.updatePreferences(auth.userId, dto) };
  }

  @Get('export')
  @Header('Content-Disposition', `attachment; filename="${EXPORT_FILENAME}"`)
  export(@CurrentAuth() auth: AuthContext): Promise<AccountExport> {
    return this.account.export(auth.userId);
  }

  @AuthThrottle()
  @Delete()
  @HttpCode(204)
  async delete(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.account.delete(auth, dto.password);
    this.cookies.clearAll(response);
  }
}
