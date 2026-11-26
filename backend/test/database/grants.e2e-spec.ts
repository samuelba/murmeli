import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { runMigrations } from '../../src/database/migrate';
import { describeWithDb } from '../support/e2e-app';

const quiet = { log: () => undefined, error: console.error };
const INIT_SCRIPT = join(
  __dirname,
  '../../docker/postgres-init/10-app-role.sh',
);

const NARROW = {
  auditUpdate: false,
  auditColumnUpdate: true,
  auditActionUpdate: false,
  auditInsert: true,
  attemptsUpdate: false,
  attemptsDelete: true,
};

const PRIVILEGES_SQL = `SELECT
  has_table_privilege($1, 'audit_log', 'UPDATE') AS "auditUpdate",
  has_column_privilege($1, 'audit_log', 'ip', 'UPDATE') AS "auditColumnUpdate",
  has_column_privilege($1, 'audit_log', 'action', 'UPDATE') AS "auditActionUpdate",
  has_table_privilege($1, 'audit_log', 'INSERT') AS "auditInsert",
  has_table_privilege($1, 'attempts', 'UPDATE') AS "attemptsUpdate",
  has_table_privilege($1, 'attempts', 'DELETE') AS "attemptsDelete"`;

function env(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (value === undefined) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

const owner = () => env('DB_MIGRATION_USERNAME', env('DATABASE_USERNAME'));
const ownerPassword = () =>
  env('DB_MIGRATION_PASSWORD', env('DATABASE_PASSWORD'));
const appRole = () => env('DATABASE_USERNAME');
const mainDb = () => env('DATABASE_NAME', 'murmeli');

function connect(database: string): Client {
  return new Client({
    host: env('DATABASE_HOST'),
    port: Number(env('DATABASE_PORT', '5432')),
    user: owner(),
    password: ownerPassword(),
    database,
  });
}

async function withOwner<T>(
  database: string,
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const client = connect(database);
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

function privileges(database: string): Promise<typeof NARROW> {
  return withOwner(database, async (client) => {
    const { rows } = await client.query<typeof NARROW>(PRIVILEGES_SQL, [
      appRole(),
    ]);
    return rows[0];
  });
}

/**
 * The SQL of the init script, without creating the role (it exists cluster
 * wide), with psql variables filled in for `database`.
 */
function initScriptSql(client: Client, database: string): string[] {
  const script = readFileSync(INIT_SCRIPT, 'utf8');
  const body = script.slice(
    script.indexOf("<<'SQL'\n") + 8,
    script.lastIndexOf('\nSQL'),
  );
  const variables: Record<string, string> = {
    app_user: appRole(),
    owner: owner(),
    db: database,
  };
  return body
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '')
    .filter((statement) => !/^(CREATE|ALTER) ROLE/.test(statement))
    .map((statement) =>
      statement.replace(/:"(\w+)"/g, (_, name: string) =>
        client.escapeIdentifier(variables[name]),
      ),
    );
}

function toolMajor(tool: string): number | null {
  const result = spawnSync(tool, ['--version'], { encoding: 'utf8' });
  const match = /(\d+)(?:\.\d+)?/.exec(result.stdout ?? '');
  return result.status === 0 && match ? Number(match[1]) : null;
}

function pgEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGHOST: env('DATABASE_HOST'),
    PGPORT: env('DATABASE_PORT', '5432'),
    PGUSER: owner(),
    PGPASSWORD: ownerPassword(),
  };
}

/** pg_dump of the e2e database, replayed with psql as the schema owner */
function dumpAndRestore(target: string): void {
  const dump = execFileSync('pg_dump', ['--dbname', mainDb()], {
    env: pgEnv(),
    maxBuffer: 256 * 1024 * 1024,
  });
  execFileSync(
    'psql',
    ['--quiet', '-v', 'ON_ERROR_STOP=1', '--dbname', target],
    { env: pgEnv(), input: dump, stdio: ['pipe', 'ignore', 'pipe'] },
  );
}

describeWithDb('Narrowed grants after migrate (e2e)', () => {
  it('narrows grants again that were widened after the migrations', async () => {
    await withOwner(mainDb(), (client) =>
      client.query(
        `GRANT UPDATE ON "audit_log", "attempts" TO ${client.escapeIdentifier(appRole())}`,
      ),
    );
    expect(await privileges(mainDb())).toMatchObject({
      auditUpdate: true,
      attemptsUpdate: true,
    });

    expect(await runMigrations(process.env, undefined, quiet)).toBe(0);

    expect(await privileges(mainDb())).toEqual(NARROW);
  });

  it('narrows the grants of a dump restored into a database the init script prepared', async () => {
    const target = `murmeli_restore_${process.pid}`;
    const serverMajor = await withOwner(mainDb(), async (client) => {
      const { rows } = await client.query<{ v: string }>(
        `SELECT current_setting('server_version_num') AS v`,
      );
      return Math.floor(Number(rows[0].v) / 10_000);
    });
    const dumpMajor = toolMajor('pg_dump');
    const canDump =
      dumpMajor !== null && dumpMajor >= serverMajor && toolMajor('psql');

    await withOwner(mainDb(), (client) =>
      client.query(`CREATE DATABASE ${client.escapeIdentifier(target)}`),
    );
    try {
      await withOwner(target, async (client) => {
        for (const statement of initScriptSql(client, target)) {
          await client.query(statement);
        }
      });
      if (canDump) {
        dumpAndRestore(target);
      } else {
        expect(
          await runMigrations(
            { ...process.env, DATABASE_NAME: target },
            undefined,
            quiet,
          ),
        ).toBe(0);
        await withOwner(target, (client) =>
          client.query(
            `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${client.escapeIdentifier(appRole())}`,
          ),
        );
      }
      expect(await privileges(target)).toMatchObject({
        auditUpdate: true,
        attemptsUpdate: true,
      });

      expect(
        await runMigrations(
          { ...process.env, DATABASE_NAME: target },
          undefined,
          quiet,
        ),
      ).toBe(0);

      expect(await privileges(target)).toEqual(NARROW);
    } finally {
      await withOwner(mainDb(), (client) =>
        client.query(
          `DROP DATABASE IF EXISTS ${client.escapeIdentifier(target)} WITH (FORCE)`,
        ),
      );
    }
  });
});
