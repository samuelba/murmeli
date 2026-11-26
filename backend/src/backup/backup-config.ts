import { z } from 'zod';
import {
  backupEnvShape,
  checkMigrationCredentials,
  databaseEnvShape,
} from '../config/env.schema';
import { parseEnvSchema } from '../config/validate-env';

const backupEnvSchema = z
  .object({ ...databaseEnvShape, ...backupEnvShape })
  .superRefine(checkMigrationCredentials);

export type BackupEnv = z.output<typeof backupEnvSchema>;

export function loadBackupEnv(raw: Record<string, unknown>): BackupEnv {
  return parseEnvSchema(backupEnvSchema, raw);
}
