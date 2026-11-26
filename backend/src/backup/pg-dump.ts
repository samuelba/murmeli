import { spawn as nodeSpawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import type { BackupEnv } from './backup-config';
import { pgEnvironment } from './pg-environment';

export type SpawnFn = typeof nodeSpawn;

export const PG_DUMP_ARGS: readonly string[] = [
  '--format=plain',
  '--no-password',
];

export function backupFileName(database: string, now: Date): string {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `backup_${database}_${timestamp}.sql.gz`;
}

/**
 * Streams `pg_dump` through gzip into `<file>.tmp` and renames it once the
 * dump succeeded. On any failure pg_dump is killed, every stream is awaited
 * and the temporary file is removed.
 */
export async function createBackup(
  env: BackupEnv,
  spawn: SpawnFn = nodeSpawn,
  now: Date = new Date(),
): Promise<string> {
  const file = join(env.BACKUP_DIR, backupFileName(env.DATABASE_NAME, now));
  const tmpFile = `${file}.tmp`;
  const child = spawn('pg_dump', [...PG_DUMP_ARGS], {
    env: { ...process.env, ...pgEnvironment(env) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  const exited = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code: number | null) =>
      code === 0
        ? resolve()
        : reject(new Error(`pg_dump exited with code ${code}`)),
    );
  });
  const written = pipeline(
    child.stdout,
    createGzip(),
    createWriteStream(tmpFile, { mode: 0o600 }),
  );

  try {
    await Promise.all([written, exited]);
    await rename(tmpFile, file);
    return file;
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
    await Promise.allSettled([written, exited]);
    await rm(tmpFile, { force: true });
    throw error;
  }
}
