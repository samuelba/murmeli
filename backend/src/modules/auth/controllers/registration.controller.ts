import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { requestMeta } from '../../../common/http/request-meta';
import {
  AuthThrottle,
  EmailThrottle,
} from '../../../throttler/auth-throttle.decorator';
import {
  EmailWithAltchaDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from '../dto/auth.dto';
import { PasswordResetService } from '../services/password-reset.service';
import {
  RegistrationService,
  type VerifiedType,
} from '../services/registration.service';

export interface Ok {
  readonly ok: true;
}

const OK: Ok = { ok: true };

@Public()
@Controller('auth')
export class RegistrationController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @EmailThrottle()
  @Post('register')
  @HttpCode(202)
  async register(@Body() dto: RegisterDto): Promise<Ok> {
    await this.registration.register(dto);
    return OK;
  }

  @AuthThrottle()
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(
    @Body() dto: TokenDto,
    @Req() request: Request,
  ): Promise<Ok & { type: VerifiedType }> {
    const type = await this.registration.verifyEmail(
      dto.token,
      requestMeta(request),
    );
    return { ok: true, type };
  }

  @EmailThrottle()
  @Post('resend-verification')
  @HttpCode(202)
  async resendVerification(@Body() dto: EmailWithAltchaDto): Promise<Ok> {
    await this.registration.resendVerification(dto);
    return OK;
  }

  @EmailThrottle()
  @Post('forgot-password')
  @HttpCode(202)
  async forgotPassword(@Body() dto: EmailWithAltchaDto): Promise<Ok> {
    await this.passwordReset.requestReset(dto);
    return OK;
  }

  @AuthThrottle()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ): Promise<Ok> {
    await this.passwordReset.reset(dto, requestMeta(request));
    return OK;
  }
}
