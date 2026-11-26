import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { requestMeta } from '../../common/http/request-meta';
import { UuidParam } from '../../common/http/uuid-param';
import type { Page } from '../../common/pagination/pagination';
import { PaginationQuery } from '../../common/pagination/pagination';
import type { AuthContext } from '../auth/auth.types';
import { AdminOnly, CurrentAuth } from '../auth/decorators/auth.decorators';
import {
  type CreatedInvite,
  InviteService,
  type InviteView,
  inviteInvalid,
} from '../auth/invites/invite.service';
import { RegistrationService } from '../auth/services/registration.service';
import { AuthThrottle } from '../../throttler/auth-throttle.decorator';
import { UsersService } from '../users/users.service';
import { CreateInviteDto, UpdateUserDto, UserSearchQuery } from './admin.dto';
import {
  AdminRecoveryService,
  type PasswordResetLink,
} from './admin-recovery.service';
import { type AdminUserView, AdminUsersService } from './admin-users.service';

@AdminOnly()
@Controller('admin')
export class AdminUsersController {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly registration: RegistrationService,
    private readonly invites: InviteService,
    private readonly users: UsersService,
    private readonly recovery: AdminRecoveryService,
  ) {}

  @Get('users')
  listUsers(@Query() query: UserSearchQuery): Promise<Page<AdminUserView>> {
    return this.adminUsers.list(query);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: Request,
  ): Promise<AdminUserView> {
    return this.adminUsers.update(
      { userId: auth.userId, ip: requestMeta(request).ip },
      id,
      dto,
    );
  }

  @Delete('users/:id')
  @HttpCode(204)
  async deleteUser(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.adminUsers.delete(
      { userId: auth.userId, ip: requestMeta(request).ip },
      id,
    );
  }

  @Post('users/:id/resend-verification')
  @HttpCode(202)
  async resendVerification(@UuidParam() id: string): Promise<{ ok: true }> {
    await this.registration.resendForUser(id);
    return { ok: true };
  }

  @Post('users/:id/password-reset-link')
  @HttpCode(201)
  @AuthThrottle()
  passwordResetLink(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
    @Req() request: Request,
  ): Promise<PasswordResetLink> {
    return this.recovery.passwordResetLink(
      { userId: auth.userId, ip: requestMeta(request).ip },
      id,
    );
  }

  @Post('users/:id/verify-email')
  @HttpCode(200)
  verifyEmail(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
    @Req() request: Request,
  ): Promise<AdminUserView> {
    return this.recovery.verifyEmail(
      { userId: auth.userId, ip: requestMeta(request).ip },
      id,
    );
  }

  @Get('invites')
  listInvites(@Query() query: PaginationQuery): Promise<Page<InviteView>> {
    return this.invites.list(query);
  }

  @Post('invites')
  @HttpCode(201)
  async createInvite(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateInviteDto,
    @Req() request: Request,
  ): Promise<CreatedInvite> {
    const admin = await this.users.findById(auth.userId);
    const created = await this.invites.create(
      dto.email,
      dto.role,
      auth.userId,
      admin?.locale ?? 'de-CH',
    );
    await this.adminUsers.recordInvite(
      'admin.invite_created',
      { userId: auth.userId, ip: requestMeta(request).ip },
      created.invite.id,
      { role: dto.role },
    );
    return created;
  }

  @Delete('invites/:id')
  @HttpCode(204)
  async revokeInvite(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
    @Req() request: Request,
  ): Promise<void> {
    if (!(await this.invites.revoke(id))) {
      throw inviteInvalid();
    }
    await this.adminUsers.recordInvite(
      'admin.invite_revoked',
      { userId: auth.userId, ip: requestMeta(request).ip },
      id,
    );
  }
}
