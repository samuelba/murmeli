import type { EntityManager } from 'typeorm';

export interface NarrowedTable {
  readonly table: string;
  /** Columns the runtime role may still UPDATE; empty for append-only tables */
  readonly updateColumns: readonly string[];
}

/**
 * Tables whose default `UPDATE` grant is narrowed for every role except the
 * schema owner: `audit_log` entries can only be anonymised, `attempts` is
 * append-only. The migrations and the migrate script both apply exactly this
 * list, so it is the single source of truth for narrowed privileges.
 */
export const NARROWED_TABLES = [
  { table: 'audit_log', updateColumns: ['actor_id', 'ip', 'target_id'] },
  { table: 'attempts', updateColumns: [] },
] as const satisfies readonly NarrowedTable[];

export type NarrowedTableName = (typeof NARROWED_TABLES)[number]['table'];

/** Session setting naming an extra role to narrow, e.g. the runtime role */
export const APP_ROLE_SETTING = 'murmeli.app_role';

function quoted(identifier: string): string {
  return `"${identifier}"`;
}

function tableBlock({ table, updateColumns }: NarrowedTable): string {
  const name = quoted(table);
  const columns = updateColumns.map(quoted).join(', ');
  const grant =
    columns === ''
      ? ''
      : `
      EXECUTE format('GRANT UPDATE (${columns}) ON ${name} TO %I', grantee_name);`;
  return `
  IF to_regclass('public.${name}') IS NOT NULL THEN
    FOR grantee_name IN
      SELECT grantee FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = '${table}'
        AND privilege_type = 'UPDATE' AND grantee <> current_user
      UNION
      SELECT rolname FROM pg_roles
      WHERE rolname = app_role AND rolname <> current_user
    LOOP
      EXECUTE format('REVOKE UPDATE ON ${name} FROM %I', grantee_name);${grant}
    END LOOP;
  END IF;`;
}

/**
 * One idempotent DO block that, for each given table, revokes the table-level
 * UPDATE from every role holding it (and from the role in
 * `murmeli.app_role`, when set and existing) and grants back only the allowed
 * columns. Tables that do not exist yet are skipped.
 */
export function narrowGrantsSql(
  tables: readonly NarrowedTableName[] = NARROWED_TABLES.map((t) => t.table),
): string {
  const blocks = NARROWED_TABLES.filter((spec) =>
    (tables as readonly string[]).includes(spec.table),
  ).map(tableBlock);
  return `
DO $$
DECLARE
  grantee_name text;
  app_role text := nullif(current_setting('${APP_ROLE_SETTING}', true), '');
BEGIN${blocks.join('')}
END
$$`;
}

/**
 * Re-asserts every narrowed grant, also for `appRole` when given. Run after
 * the migrations, so a restored dump or re-applied default privileges cannot
 * leave the runtime role with wider rights than the migrations intended.
 */
export async function assertNarrowedGrants(
  manager: Pick<EntityManager, 'query'>,
  appRole: string | null,
): Promise<void> {
  await manager.query(`SELECT set_config($1, $2, true)`, [
    APP_ROLE_SETTING,
    appRole ?? '',
  ]);
  await manager.query(narrowGrantsSql());
}
