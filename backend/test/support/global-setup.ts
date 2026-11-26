import { Redis } from 'ioredis';
import { Client } from 'pg';
import { runMigrations } from '../../src/database/migrate';

const RESET_SQL = `TRUNCATE "users", "audit_log", "invites" RESTART IDENTITY CASCADE`;

/**
 * Real-DB e2e only: migrates as the schema owner, then starts from an empty
 * users table and an empty Redis, so the setup flow can run. The app itself
 * runs as the least-privileged DATABASE_USERNAME.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_DB !== '1') {
    return;
  }
  const quiet = { log: () => undefined, error: console.error };
  if ((await runMigrations(process.env, undefined, quiet)) !== 0) {
    throw new Error('e2e migrations failed');
  }
  const owner = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DB_MIGRATION_USERNAME ?? process.env.DATABASE_USERNAME,
    password:
      process.env.DB_MIGRATION_PASSWORD ?? process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME ?? 'murmeli',
  });
  await owner.connect();
  try {
    await owner.query(RESET_SQL);
  } finally {
    await owner.end();
  }
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  });
  await redis.flushdb();
  await redis.quit();
}
