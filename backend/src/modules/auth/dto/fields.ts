import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { LOCALES } from '../../users/user.types';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../auth.constants';

const trimmed = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export const EmailField = () =>
  applyDecorators(
    trimmed(),
    IsString(),
    MaxLength(EMAIL_MAX_LENGTH),
    IsEmail({ allow_display_name: false, require_tld: true }),
  );

export const PasswordField = () =>
  applyDecorators(IsString(), Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH));

export const CurrentPasswordField = () =>
  applyDecorators(IsString(), Length(1, PASSWORD_MAX_LENGTH));

export const LocaleField = () => applyDecorators(IsIn(LOCALES));

export const AcceptTermsField = () => applyDecorators(Equals(true));

export const TokenField = () => applyDecorators(IsString(), Length(1, 128));

export const AltchaField = () => applyDecorators(IsString(), Length(1, 4096));
