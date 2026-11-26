import type { EntityManager } from 'typeorm';

export const ANONYMIZE_AUDIT_SQL: readonly string[] = [
  `UPDATE "audit_log" SET "actor_id" = NULL, "ip" = NULL WHERE "actor_id" = $1`,
  `UPDATE "audit_log" SET "target_id" = NULL
   WHERE "target_type" = 'user' AND "target_id" = $1::text`,
  `UPDATE "audit_log" SET "target_id" = NULL
   WHERE "target_type" = 'kid'
     AND "target_id" IN (SELECT "id"::text FROM "kids" WHERE "user_id" = $1)`,
];

/**
 * Hard-deletes a user inside the caller's transaction. Their kids, tokens and
 * secrets go with the foreign-key cascade; audit entries stay but lose every
 * reference to the user, their kids and their IP.
 */
export async function deleteUserIn(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  for (const sql of ANONYMIZE_AUDIT_SQL) {
    await manager.query(sql, [userId]);
  }
  await manager.query('DELETE FROM "users" WHERE "id" = $1', [userId]);
}
