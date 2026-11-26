import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthMailer } from '../auth/services/auth-mailer';
import {
  type AccessSettingsPatch,
  SettingsService,
} from '../settings/settings.service';

export interface AdminSettingsView {
  readonly registrationEnabled: boolean;
  readonly requireAdminTotp: boolean;
  readonly emailEnabled: boolean;
}

export interface AdminStatsView {
  readonly users: number;
  readonly kids: number;
  readonly activeKidsLast7Days: number;
}

export const STATS_SQL = `SELECT
  (SELECT COUNT(*)::int FROM "users") AS "users",
  (SELECT COUNT(*)::int FROM "kids") AS "kids",
  (SELECT COUNT(*)::int FROM "kids" WHERE "last_active_at" > now() - interval '7 days') AS "activeKidsLast7Days"`;

@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly settings: SettingsService,
    private readonly mailer: AuthMailer,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async settingsView(): Promise<AdminSettingsView> {
    const access = await this.settings.accessSettings();
    return { ...access, emailEnabled: this.mailer.enabled };
  }

  async updateSettings(
    actorId: string,
    ip: string | null,
    patch: AccessSettingsPatch,
  ): Promise<AdminSettingsView> {
    const access = await this.settings.update(patch);
    await this.audit.record({
      action: 'admin.settings_updated',
      actorId,
      targetType: 'setting',
      ip,
      meta: Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ),
    });
    return { ...access, emailEnabled: this.mailer.enabled };
  }

  async stats(): Promise<AdminStatsView> {
    const [row] = await this.dataSource.query<AdminStatsView[]>(STATS_SQL);
    return row;
  }
}
