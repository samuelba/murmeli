import { z } from 'zod';
import {
  checkMigrationCredentials,
  databaseEnvShape,
} from '../config/env.schema';
import { parseEnvSchema } from '../config/validate-env';

const databaseEnvSchema = z
  .object(databaseEnvShape)
  .superRefine(checkMigrationCredentials);

export type DatabaseEnv = z.output<typeof databaseEnvSchema>;

export function loadDatabaseEnv(
  raw: Record<string, unknown> = process.env,
): DatabaseEnv {
  return parseEnvSchema(databaseEnvSchema, raw);
}
