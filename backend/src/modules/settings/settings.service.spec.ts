import type { Repository } from 'typeorm';
import type { AppSettingEntity } from './app-setting.entity';
import { SettingsService } from './settings.service';

function service(rows: Partial<AppSettingEntity>[] = []) {
  const repository = {
    findBy: jest.fn().mockResolvedValue(rows),
    upsert: jest.fn().mockResolvedValue({}),
  };
  return {
    repository,
    settings: new SettingsService(
      repository as unknown as Repository<AppSettingEntity>,
    ),
  };
}

describe('SettingsService', () => {
  it('reads both access settings', async () => {
    const { settings } = service([
      { key: 'registration_enabled', value: true },
      { key: 'require_admin_totp', value: false },
    ]);

    await expect(settings.accessSettings()).resolves.toEqual({
      registrationEnabled: true,
      requireAdminTotp: false,
    });
  });

  it('treats missing or non-boolean values as off', async () => {
    const { settings } = service([
      { key: 'registration_enabled', value: 'yes' },
    ]);

    await expect(settings.isRegistrationEnabled()).resolves.toBe(false);
    await expect(settings.isAdminTotpRequired()).resolves.toBe(false);
  });

  it('reports require_admin_totp', async () => {
    const { settings } = service([{ key: 'require_admin_totp', value: true }]);

    await expect(settings.isAdminTotpRequired()).resolves.toBe(true);
  });

  it('stores only the given values with source admin', async () => {
    const { settings, repository } = service();

    await settings.update({
      requireAdminTotp: true,
      registrationEnabled: undefined,
    });

    expect(repository.upsert).toHaveBeenCalledWith(
      [{ key: 'require_admin_totp', value: true, source: 'admin' }],
      ['key'],
    );
  });

  it('skips the write for an empty patch', async () => {
    const { settings, repository } = service();

    await settings.update({});

    expect(repository.upsert).not.toHaveBeenCalled();
    expect(repository.findBy).toHaveBeenCalled();
  });
});
