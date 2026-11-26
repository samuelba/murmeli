import { HttpStatus, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, type EntityManager } from 'typeorm';
import { apiError } from '../../common/errors/api-exception';
import { UserEntity } from './user.entity';

export const ADMIN_LOCK_ID = 7_201_814_311;

export function lastAdmin() {
  return apiError(
    HttpStatus.BAD_REQUEST,
    'LAST_ADMIN',
    'At least one active admin must remain',
  );
}

export function userNotFound() {
  return apiError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
}

/** Whether a change takes the user out of the set of active admins */
export type LosesAdmin = (user: UserEntity) => boolean;

export type UserMutation<T> = (
  manager: EntityManager,
  user: UserEntity,
) => Promise<T>;

const OTHER_ACTIVE_ADMINS_SQL = `SELECT COUNT(*)::int AS "count" FROM "users"
  WHERE "role" = 'admin' AND "disabled" = false AND "id" <> $1`;

function isActiveAdmin(user: UserEntity): boolean {
  return user.role === 'admin' && !user.disabled;
}

/**
 * Runs a change to a user in one transaction under a global advisory lock,
 * after checking that at least one other active admin remains whenever the
 * change removes this user's admin rights. Every demotion, disabling and
 * deletion goes through here, so concurrent changes cannot remove the last
 * admin.
 */
@Injectable()
export class UserGuardrail {
  constructor(private readonly dataSource: DataSource) {}

  mutate<T>(
    userId: string,
    losesAdmin: LosesAdmin,
    mutation: UserMutation<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_LOCK_ID]);
      const user = isUUID(userId)
        ? await manager.findOneBy(UserEntity, { id: userId })
        : null;
      if (!user) {
        throw userNotFound();
      }
      if (isActiveAdmin(user) && losesAdmin(user)) {
        const [row] = await manager.query<{ count: number }[]>(
          OTHER_ACTIVE_ADMINS_SQL,
          [user.id],
        );
        if (row.count === 0) {
          throw lastAdmin();
        }
      }
      return mutation(manager, user);
    });
  }
}
