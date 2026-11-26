import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { gunzipSync } from 'node:zlib';
import { validRawEnv } from '../../test/fixtures/env';
import { type BackupEnv, loadBackupEnv } from './backup-config';
import {
  PG_DUMP_ARGS,
  type SpawnFn,
  backupFileName,
  createBackup,
} from './pg-dump';

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  exitCode: number | null = null;
  signalCode: string | null = null;
  readonly kill = jest.fn((signal: string) => {
    this.signalCode = signal;
    this.stdout.destroy();
    setImmediate(() => this.emit('close', null));
    return true;
  });

  finish(code: number): void {
    this.exitCode = code;
    this.emit('close', code);
  }
}

function fakeSpawn(run: (child: FakeChild) => void) {
  const children: FakeChild[] = [];
  const spawn = jest.fn(() => {
    const child = new FakeChild();
    children.push(child);
    setImmediate(() => run(child));
    return child;
  });
  return { spawn: spawn as unknown as SpawnFn & jest.Mock, children };
}

const NOW = new Date('2026-11-26T10:20:30.456Z');

describe('createBackup', () => {
  let dir: string;
  let env: BackupEnv;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'murmeli-dump-'));
    env = loadBackupEnv(validRawEnv({ BACKUP_DIR: dir }));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('names backups after the database and time', () => {
    expect(backupFileName('murmeli', NOW)).toBe(
      'backup_murmeli_2026-11-26T10-20-30-456Z.sql.gz',
    );
  });

  it('writes the gzipped dump and renames it into place', async () => {
    const { spawn } = fakeSpawn((child) => {
      child.stdout.end('CREATE TABLE x();\n');
      child.stdout.once('end', () => child.finish(0));
    });

    const file = await createBackup(env, spawn, NOW);

    expect(file).toBe(join(dir, backupFileName('murmeli', NOW)));
    expect(await readdir(dir)).toEqual([backupFileName('murmeli', NOW)]);
    expect(gunzipSync(await readFile(file)).toString()).toBe(
      'CREATE TABLE x();\n',
    );
  });

  it('passes the connection only through the environment', async () => {
    const { spawn } = fakeSpawn((child) => {
      child.stdout.end();
      child.stdout.once('end', () => child.finish(0));
    });

    await createBackup(env, spawn, NOW);

    expect(spawn).toHaveBeenCalledWith(
      'pg_dump',
      [...PG_DUMP_ARGS],
      expect.objectContaining({
        env: expect.objectContaining({
          PGPASSWORD: 'murmeli',
          PGDATABASE: 'murmeli',
        }),
      }),
    );
    expect(PG_DUMP_ARGS.join(' ')).not.toContain('murmeli');
  });

  it('removes the temporary file when pg_dump fails', async () => {
    const { spawn, children } = fakeSpawn((child) => {
      child.stdout.end('partial');
      child.stdout.once('end', () => child.finish(1));
    });

    await expect(createBackup(env, spawn, NOW)).rejects.toThrow(
      'pg_dump exited with code 1',
    );
    expect(await readdir(dir)).toEqual([]);
    expect(children[0].kill).not.toHaveBeenCalled();
  });

  it('kills pg_dump when writing fails', async () => {
    const { spawn, children } = fakeSpawn((child) => {
      child.stdout.write('data');
    });
    const missingDir = loadBackupEnv(
      validRawEnv({ BACKUP_DIR: join(dir, 'missing') }),
    );

    await expect(createBackup(missingDir, spawn, NOW)).rejects.toThrow(
      /ENOENT/,
    );
    expect(children[0].kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('fails when pg_dump cannot start', async () => {
    const { spawn } = fakeSpawn((child) => {
      child.emit('error', new Error('spawn pg_dump ENOENT'));
      child.stdout.end();
    });

    await expect(createBackup(env, spawn, NOW)).rejects.toThrow('ENOENT');
    expect(await readdir(dir)).toEqual([]);
  });
});
