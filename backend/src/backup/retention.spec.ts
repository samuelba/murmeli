import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseBackupFile,
  pruneBackups,
  selectBackupsToDelete,
} from './retention';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-26T12:00:00.000Z');

function name(daysAgo: number): string {
  const timestamp = new Date(NOW - daysAgo * DAY)
    .toISOString()
    .replace(/[:.]/g, '-');
  return `backup_murmeli_${timestamp}.sql.gz`;
}

describe('parseBackupFile', () => {
  it('reads the timestamp from the file name', () => {
    expect(
      parseBackupFile('backup_my_db_2026-11-26T10-20-30-456Z.sql.gz'),
    ).toEqual({
      name: 'backup_my_db_2026-11-26T10-20-30-456Z.sql.gz',
      createdAt: Date.parse('2026-11-26T10:20:30.456Z'),
    });
  });

  it.each([
    'backup_murmeli_2026-11-26T10-20-30-456Z.sql',
    'backup_murmeli_2026-11-26T10-20-30-456Z.sql.gz.tmp',
    'backup_murmeli_2026-13-45T10-20-30-456Z.sql.gz',
    'notes.txt',
  ])('ignores %s', (file) => {
    expect(parseBackupFile(file)).toBeUndefined();
  });
});

describe('selectBackupsToDelete', () => {
  const file = (daysAgo: number) => parseBackupFile(name(daysAgo))!;

  it('keeps the newest BACKUP_KEEP_COUNT backups', () => {
    const files = [file(1), file(3), file(2)];

    expect(
      selectBackupsToDelete(files, { keepCount: 2, maxAgeDays: 30 }, NOW),
    ).toEqual([file(3)]);
  });

  it('deletes backups older than BACKUP_MAX_AGE_DAYS', () => {
    const files = [file(1), file(31), file(40)];

    expect(
      selectBackupsToDelete(files, { keepCount: 10, maxAgeDays: 30 }, NOW),
    ).toEqual([file(31), file(40)]);
  });

  it('always keeps the newest backup', () => {
    expect(
      selectBackupsToDelete(
        [file(90), file(100)],
        { keepCount: 1, maxAgeDays: 30 },
        NOW,
      ),
    ).toEqual([file(100)]);
  });
});

describe('pruneBackups', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'murmeli-backups-'));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('removes expired backups and stale temp files only', async () => {
    const files = [
      name(1),
      name(2),
      name(45),
      `${name(0)}.tmp`,
      'backup_manual.sql',
      'notes.txt',
    ];
    await Promise.all(files.map((file) => writeFile(join(dir, file), '')));

    const removed = await pruneBackups(
      dir,
      { keepCount: 10, maxAgeDays: 30 },
      NOW,
    );

    expect(removed.sort()).toEqual([name(45), `${name(0)}.tmp`].sort());
    expect((await readdir(dir)).sort()).toEqual(
      [name(1), name(2), 'backup_manual.sql', 'notes.txt'].sort(),
    );
  });
});
