import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export interface BackupFile {
  readonly name: string;
  readonly createdAt: number;
}

export interface RetentionPolicy {
  readonly keepCount: number;
  readonly maxAgeDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_FILE =
  /^backup_.+_(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.sql\.gz$/;
const STALE_TEMP_FILE = /^backup_.+\.sql\.gz\.tmp$/;

export function parseBackupFile(name: string): BackupFile | undefined {
  const match = BACKUP_FILE.exec(name);
  if (!match) {
    return undefined;
  }
  const [, date, hours, minutes, seconds, millis] = match;
  const createdAt = Date.parse(
    `${date}T${hours}:${minutes}:${seconds}.${millis}Z`,
  );
  return Number.isNaN(createdAt) ? undefined : { name, createdAt };
}

/**
 * Keeps at most `keepCount` backups and drops those older than `maxAgeDays`,
 * but never deletes the newest backup.
 */
export function selectBackupsToDelete(
  files: readonly BackupFile[],
  policy: RetentionPolicy,
  now: number,
): BackupFile[] {
  const oldestAllowed = now - policy.maxAgeDays * DAY_MS;
  return [...files]
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter(
      (file, index) =>
        index > 0 &&
        (index >= policy.keepCount || file.createdAt < oldestAllowed),
    );
}

export async function pruneBackups(
  dir: string,
  policy: RetentionPolicy,
  now: number = Date.now(),
): Promise<string[]> {
  const names = await readdir(dir);
  const backups = names
    .map(parseBackupFile)
    .filter((file): file is BackupFile => file !== undefined);
  const doomed = [
    ...selectBackupsToDelete(backups, policy, now).map((file) => file.name),
    ...names.filter((name) => STALE_TEMP_FILE.test(name)),
  ];
  await Promise.all(doomed.map((name) => unlink(join(dir, name))));
  return doomed;
}
