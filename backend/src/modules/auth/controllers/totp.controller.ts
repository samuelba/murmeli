import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requestMeta } from '../../../common/http/request-meta';
import { AuthThrottle } from '../../../throttler/auth-throttle.decorator';
import type { AuthContext } from '../auth.types';
import { CurrentAuth, RequireParentGate } from '../decorators/auth.decorators';
import { TotpCodeDto, TotpDisableDto } from '../dto/totp.dto';
import { type TotpSetup, TotpService } from '../totp/totp.service';

export interface RecoveryCodesView {
  readonly recoveryCodes: string[];
}

@RequireParentGate()
@AuthThrottle()
@Controller('auth/totp')
export class TotpController {
  constructor(private readonly totp: TotpService) {}

  @Post('setup')
  @HttpCode(200)
  setup(@CurrentAuth() auth: AuthContext): Promise<TotpSetup> {
    return this.totp.setup(auth.userId);
  }

  @Post('enable')
  @HttpCode(200)
  async enable(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: TotpCodeDto,
    @Req() request: Request,
  ): Promise<RecoveryCodesView> {
    const recoveryCodes = await this.totp.enable(
      { userId: auth.userId, ip: requestMeta(request).ip },
      dto.code,
    );
    return { recoveryCodes };
  }

  @Post('disable')
  @HttpCode(204)
  async disable(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: TotpDisableDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.totp.disable(
      { userId: auth.userId, ip: requestMeta(request).ip },
      dto.password,
      dto.code,
    );
  }

  @Post('recovery-codes')
  @HttpCode(200)
  async recoveryCodes(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: TotpCodeDto,
  ): Promise<RecoveryCodesView> {
    return {
      recoveryCodes: await this.totp.regenerateRecoveryCodes(
        auth.userId,
        dto.code,
      ),
    };
  }
}
