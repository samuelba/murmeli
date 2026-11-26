import { IsString, Matches } from 'class-validator';
import { CurrentPasswordField } from './fields';

export class TotpCodeDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class TotpDisableDto {
  @CurrentPasswordField()
  password: string;

  @IsString()
  @Matches(/^[A-Za-z0-9 -]{6,32}$/)
  code: string;
}
