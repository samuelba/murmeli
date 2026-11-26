import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQuery } from '../../common/pagination/pagination';
import { AUDIT_ACTIONS, type AuditAction } from '../audit/audit.types';
import { EmailField } from '../auth/dto/fields';
import { ROLES, type Role } from '../users/user.types';

export class UserSearchQuery extends PaginationQuery {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(254)
  search?: string;
}

export class AuditLogQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;
}

export class UpdateUserDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  disabled?: boolean;
}

export class CreateInviteDto {
  @EmailField()
  email: string;

  @IsIn(ROLES)
  role: Role;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  requireAdminTotp?: boolean;
}
