import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { requestMeta } from '../../../common/http/request-meta';
import { AuthThrottle } from '../../../throttler/auth-throttle.decorator';
import { SettingsService } from '../../settings/settings.service';
import type { UserView } from '../../users/user.view';
import { LoginDto, SetupDto, TotpVerifyDto } from '../dto/auth.dto';
import { SessionIssuer } from '../sessions/session-issuer';
import { AuthMailer } from '../services/auth-mailer';
import { type LoginResult, LoginService } from '../services/login.service';
import { SessionFlowService } from '../services/session-flow.service';
import { SetupService } from '../services/setup.service';

export interface AuthConfigView {
  readonly registrationEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly setupRequired: boolean;
  readonly setupTokenRequired: boolean;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly settings: SettingsService,
    private readonly setupService: SetupService,
    private readonly login: LoginService,
    private readonly sessionFlow: SessionFlowService,
    private readonly issuer: SessionIssuer,
    private readonly mailer: AuthMailer,
  ) {}

  @Public()
  @Get('config')
  async config(): Promise<AuthConfigView> {
    const [registrationEnabled, setupRequired] = await Promise.all([
      this.settings.isRegistrationEnabled(),
      this.setupService.isRequired(),
    ]);
    return {
      registrationEnabled,
      emailEnabled: this.mailer.enabled,
      setupRequired,
      setupTokenRequired: this.setupService.tokenRequired,
    };
  }

  @Public()
  @AuthThrottle()
  @Post('setup')
  @HttpCode(201)
  async setup(
    @Body() dto: SetupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserView }> {
    const admin = await this.setupService.createFirstAdmin(dto);
    const user = await this.issuer.signIn(
      response,
      admin,
      requestMeta(request),
      'setup',
    );
    return { user };
  }

  @Public()
  @AuthThrottle()
  @Post('login')
  @HttpCode(200)
  signIn(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResult> {
    return this.login.login(dto, requestMeta(request), response);
  }

  @Public()
  @AuthThrottle()
  @Post('totp/verify')
  @HttpCode(200)
  verifyTotp(
    @Body() dto: TotpVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserView }> {
    return this.login.verifyTotp(dto, requestMeta(request), request, response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    await this.sessionFlow.refresh(request, response, requestMeta(request));
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessionFlow.logout(request, response, requestMeta(request));
  }
}
