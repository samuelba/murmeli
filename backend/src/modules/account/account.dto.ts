import { IsIn, IsOptional } from 'class-validator';
import {
  CurrentPasswordField,
  EmailField,
  PasswordField,
} from '../auth/dto/fields';
import { LOCALES, type Locale, THEMES, type Theme } from '../users/user.types';

export class ChangePasswordDto {
  @CurrentPasswordField()
  currentPassword: string;

  @PasswordField()
  newPassword: string;
}

export class ChangeEmailDto {
  @EmailField()
  newEmail: string;

  @CurrentPasswordField()
  password: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsIn(LOCALES)
  locale?: Locale;

  @IsOptional()
  @IsIn(THEMES)
  theme?: Theme;
}

export class DeleteAccountDto {
  @CurrentPasswordField()
  password: string;
}
