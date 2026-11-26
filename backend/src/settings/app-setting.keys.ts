export const REGISTRATION_ENABLED_SETTING = 'registration_enabled';

export const SETTING_SOURCES = ['env', 'admin'] as const;
export type SettingSource = (typeof SETTING_SOURCES)[number];
