import { validRawEnv } from './fixtures/env';

const defaults: Record<string, string | undefined> = {
  ...validRawEnv(),
  LOG_LEVEL: 'silent',
  BACKUP_DIR: './backups',
};

for (const [name, value] of Object.entries(defaults)) {
  process.env[name] ??= value;
}
