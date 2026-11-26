import { getMetadataArgsStorage } from 'typeorm';
import { AppSettingEntity } from './app-setting.entity';

describe('AppSettingEntity', () => {
  const storage = getMetadataArgsStorage();

  it('maps to app_settings', () => {
    const columns = storage.columns
      .filter((column) => column.target === AppSettingEntity)
      .map((column) => [column.propertyName, column.options.type]);

    expect(
      storage.tables.find((table) => table.target === AppSettingEntity)?.name,
    ).toBe('app_settings');
    expect(columns).toEqual([
      ['key', 'text'],
      ['value', 'jsonb'],
      ['source', 'text'],
      ['updatedAt', 'timestamptz'],
    ]);
  });

  it('restricts the source to env or admin', () => {
    expect(
      storage.checks.find((check) => check.target === AppSettingEntity)
        ?.expression,
    ).toBe(`"source" IN ('env', 'admin')`);
  });
});
