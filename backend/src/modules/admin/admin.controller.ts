import { Body, Controller, Get, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requestMeta } from '../../common/http/request-meta';
import type { Page } from '../../common/pagination/pagination';
import { type AuditEntryView, AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { AdminOnly, CurrentAuth } from '../auth/decorators/auth.decorators';
import { AuditLogQuery, UpdateSettingsDto } from './admin.dto';
import {
  AdminOverviewService,
  type AdminSettingsView,
  type AdminStatsView,
} from './admin-overview.service';

@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly overview: AdminOverviewService,
    private readonly audit: AuditService,
  ) {}

  @Get('settings')
  settings(): Promise<AdminSettingsView> {
    return this.overview.settingsView();
  }

  @Patch('settings')
  updateSettings(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpdateSettingsDto,
    @Req() request: Request,
  ): Promise<AdminSettingsView> {
    return this.overview.updateSettings(
      auth.userId,
      requestMeta(request).ip,
      dto,
    );
  }

  @Get('stats')
  stats(): Promise<AdminStatsView> {
    return this.overview.stats();
  }

  @Get('audit-log')
  auditLog(@Query() query: AuditLogQuery): Promise<Page<AuditEntryView>> {
    return this.audit.list(query);
  }
}
