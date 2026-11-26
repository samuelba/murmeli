import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppSettingEntity } from './app-setting.entity';
import {
  REGISTRATION_ENABLED_SETTING,
  REQUIRE_ADMIN_TOTP_SETTING,
} from './app-setting.keys';

export interface AccessSettings {
  readonly registrationEnabled: boolean;
  readonly requireAdminTotp: boolean;
}

export type AccessSettingsPatch = Partial<AccessSettings>;

const KEYS: Readonly<Record<keyof AccessSettings, string>> = {
  registrationEnabled: REGISTRATION_ENABLED_SETTING,
  requireAdminTotp: REQUIRE_ADMIN_TOTP_SETTING,
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly repository: Repository<AppSettingEntity>,
  ) {}

  async accessSettings(): Promise<AccessSettings> {
    const rows = await this.repository.findBy({ key: In(Object.values(KEYS)) });
    const value = (key: string) =>
      rows.find((row) => row.key === key)?.value === true;
    return {
      registrationEnabled: value(KEYS.registrationEnabled),
      requireAdminTotp: value(KEYS.requireAdminTotp),
    };
  }

  async isRegistrationEnabled(): Promise<boolean> {
    return (await this.accessSettings()).registrationEnabled;
  }

  async isAdminTotpRequired(): Promise<boolean> {
    return (await this.accessSettings()).requireAdminTotp;
  }

  /**
   * Stores admin changes with source = 'admin', so the env defaults no longer
   * overwrite them at startup.
   */
  async update(patch: AccessSettingsPatch): Promise<AccessSettings> {
    const entries = (
      Object.entries(patch) as [keyof AccessSettings, boolean | undefined][]
    ).filter(([, value]) => value !== undefined);
    if (entries.length > 0) {
      await this.repository.upsert(
        entries.map(([name, value]) => ({
          key: KEYS[name],
          value,
          source: 'admin' as const,
        })),
        ['key'],
      );
    }
    return this.accessSettings();
  }
}
