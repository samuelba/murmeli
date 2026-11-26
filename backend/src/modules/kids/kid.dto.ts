import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LOCALES, type Locale } from '../users/user.types';
import {
  BIRTH_YEAR_MAX,
  BIRTH_YEAR_MIN,
  DAILY_LIMIT_MAX,
  DAILY_LIMIT_MIN,
  NICKNAME_PATTERN,
  PIN_LENGTH,
  PIN_MAX_INDEX,
  READ_ALOUD_MODES,
  type ReadAloud,
  START_CLASSES,
  type StartClass,
} from './kid.types';

const IfPresent = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
const IfNotNull = () =>
  ValidateIf(
    (_object: unknown, value: unknown) => value !== undefined && value !== null,
  );

const NicknameField = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().normalize('NFC') : value,
    ),
    IsString(),
    Matches(NICKNAME_PATTERN),
  );

const PinField = () =>
  applyDecorators(
    IsArray(),
    ArrayMinSize(PIN_LENGTH),
    ArrayMaxSize(PIN_LENGTH),
    IsInt({ each: true }),
    Min(0, { each: true }),
    Max(PIN_MAX_INDEX, { each: true }),
  );

export class AvatarDto {
  @IsString()
  @MaxLength(32)
  animal: string;

  @IfNotNull()
  @IsString()
  @MaxLength(32)
  accessory: string | null;

  @IsString()
  @MaxLength(16)
  background: string;
}

const AvatarField = () =>
  applyDecorators(
    IsObject(),
    ValidateNested(),
    Type(() => AvatarDto),
  );

export class CreateKidDto {
  @NicknameField()
  nickname: string;

  @AvatarField()
  avatar: AvatarDto;

  @IsIn(START_CLASSES)
  startClass: StartClass;

  @IsOptional()
  @IsInt()
  @Min(BIRTH_YEAR_MIN)
  @Max(BIRTH_YEAR_MAX)
  birthYear?: number | null;

  @IsIn(LOCALES)
  language: Locale;

  @IsOptional()
  @PinField()
  pin?: number[] | null;

  @IsOptional()
  @IsInt()
  @Min(DAILY_LIMIT_MIN)
  @Max(DAILY_LIMIT_MAX)
  dailyLimitMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @IsOptional()
  @IsIn(READ_ALOUD_MODES)
  readAloud?: ReadAloud;
}

export class UpdateKidDto {
  @IfPresent()
  @NicknameField()
  nickname?: string;

  @IfPresent()
  @AvatarField()
  avatar?: AvatarDto;

  @IfPresent()
  @IsIn(START_CLASSES)
  startClass?: StartClass;

  @IfNotNull()
  @IsInt()
  @Min(BIRTH_YEAR_MIN)
  @Max(BIRTH_YEAR_MAX)
  birthYear?: number | null;

  @IfPresent()
  @IsIn(LOCALES)
  language?: Locale;

  @IfNotNull()
  @PinField()
  pin?: number[] | null;

  @IfNotNull()
  @IsInt()
  @Min(DAILY_LIMIT_MIN)
  @Max(DAILY_LIMIT_MAX)
  dailyLimitMinutes?: number | null;

  @IfPresent()
  @IsBoolean()
  soundEnabled?: boolean;

  @IfPresent()
  @IsIn(READ_ALOUD_MODES)
  readAloud?: ReadAloud;
}

export class ActivateKidDto {
  @IsOptional()
  @PinField()
  pin?: number[];
}
