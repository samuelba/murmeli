import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AltchaModule } from '../altcha/altcha.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { InvitesController } from './controllers/invites.controller';
import { ParentGateController } from './controllers/parent-gate.controller';
import { RegistrationController } from './controllers/registration.controller';
import { TotpController } from './controllers/totp.controller';
import { AuthCookies } from './cookies/auth-cookies';
import { EmailTokenEntity } from './entities/email-token.entity';
import { InviteEntity } from './entities/invite.entity';
import { RecoveryCodeEntity } from './entities/recovery-code.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { TotpSecretEntity } from './entities/totp-secret.entity';
import { AdminGuard } from './guards/admin.guard';
import { AuthGuard } from './guards/auth.guard';
import { ParentGateGuard } from './guards/parent-gate.guard';
import { InviteService } from './invites/invite.service';
import { AttemptLimiter } from './limits/attempt-limiter.service';
import { LimitPolicies } from './limits/limit-policies';
import { PasswordService } from './passwords/password.service';
import { AuthMailer } from './services/auth-mailer';
import { EmailTokenService } from './services/email-token.service';
import { LoginService } from './services/login.service';
import { ParentGateService } from './services/parent-gate.service';
import { PasswordResetService } from './services/password-reset.service';
import { RegistrationService } from './services/registration.service';
import { SessionFlowService } from './services/session-flow.service';
import { SetupService } from './services/setup.service';
import { SessionIssuer } from './sessions/session-issuer';
import { SessionService } from './sessions/session.service';
import { TokenService } from './tokens/token.service';
import { RecoveryCodeService } from './totp/recovery-code.service';
import { TotpService } from './totp/totp.service';

const SHARED = [
  AuthCookies,
  TokenService,
  SessionService,
  SessionIssuer,
  PasswordService,
  AttemptLimiter,
  LimitPolicies,
  AuthMailer,
  EmailTokenService,
  InviteService,
  RegistrationService,
  ParentGateGuard,
  AdminGuard,
];

@Module({
  imports: [
    UsersModule,
    AltchaModule,
    TypeOrmModule.forFeature([
      RefreshTokenEntity,
      EmailTokenEntity,
      InviteEntity,
      TotpSecretEntity,
      RecoveryCodeEntity,
    ]),
  ],
  controllers: [
    AuthController,
    RegistrationController,
    ParentGateController,
    TotpController,
    InvitesController,
  ],
  providers: [
    ...SHARED,
    LoginService,
    PasswordResetService,
    SetupService,
    ParentGateService,
    SessionFlowService,
    RecoveryCodeService,
    TotpService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [...SHARED, UsersModule],
})
export class AuthModule {}
