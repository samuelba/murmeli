import {
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import type { Locale } from '../../users/user.types';
import {
  AcceptTermsField,
  AltchaField,
  CurrentPasswordField,
  EmailField,
  LocaleField,
  PasswordField,
  TokenField,
} from './fields';

export class SetupDto {
  @EmailField()
  email: string;

  @PasswordField()
  password: string;

  @LocaleField()
  locale: Locale;

  @IsOptional()
  @IsString()
  @Length(1, 256)
  setupToken?: string;
}

export class RegisterDto {
  @EmailField()
  email: string;

  @PasswordField()
  password: string;

  @LocaleField()
  locale: Locale;

  @AcceptTermsField()
  acceptTerms: true;

  @AltchaField()
  altcha: string;
}

export class EmailWithAltchaDto {
  @EmailField()
  email: string;

  @AltchaField()
  altcha: string;
}

export class TokenDto {
  @TokenField()
  token: string;
}

export class ResetPasswordDto {
  @TokenField()
  token: string;

  @PasswordField()
  password: string;
}

export class LoginDto {
  @EmailField()
  email: string;

  @CurrentPasswordField()
  password: string;
}

export class TotpVerifyDto {
  @ValidateIf((dto: TotpVerifyDto) => dto.recoveryCode === undefined)
  @IsString()
  @Matches(/^\d{6}$/)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  recoveryCode?: string;
}

export class PasswordDto {
  @CurrentPasswordField()
  password: string;
}

export class AcceptInviteDto {
  @PasswordField()
  password: string;

  @LocaleField()
  locale: Locale;

  @AcceptTermsField()
  acceptTerms: true;
}
