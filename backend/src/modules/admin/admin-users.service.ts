import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { apiError } from '../../common/errors/api-exception';
import {
  type Page,
  pageWindow,
  toPage,
} from '../../common/pagination/pagination';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/sessions/session.service';
import type { RevocationReason } from '../auth/entities/refresh-token.entity';
import { deleteUserIn } from '../users/user-deletion';
import { UserGuardrail, userNotFound } from '../users/user-guardrail.service';
import { UserEntity } from '../users/user.entity';
import { type UserView, toUserView } from '../users/user.view';
import type { UpdateUserDto, UserSearchQuery } from './admin.dto';

export interface AdminUserView extends UserView {
  readonly disabled: boolean;
  readonly kidCount: number;
  readonly lastLoginAt: string | null;
}

export interface AdminActor {
  readonly userId: string;
  readonly ip: string | null;
}

const KID_COUNT_SQL = `(SELECT COUNT(*) FROM "kids" "kid" WHERE "kid"."user_id" = "user"."id")`;

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toAdminUserView(user: UserEntity, kidCount: number): AdminUserView {
  return {
    ...toUserView(user),
    disabled: user.disabled,
    kidCount,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

/**
 * Disabling or changing the role ends every session of the user, so no
 * token issued under the old state stays usable.
 */
export function sessionEndReason(
  user: UserEntity,
  dto: UpdateUserDto,
): RevocationReason | null {
  if (dto.disabled === true && !user.disabled) {
    return 'disabled';
  }
  return dto.role !== undefined && dto.role !== user.role
    ? 'role_changed'
    : null;
}

/**
 * Admin user management. Every change that can remove an admin goes through
 * UserGuardrail, so at least one active admin always remains.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly guardrail: UserGuardrail,
  ) {}

  async list(query: UserSearchQuery): Promise<Page<AdminUserView>> {
    const window = pageWindow(query);
    const builder = this.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .addSelect(KID_COUNT_SQL, 'kid_count')
      .orderBy('user.created_at', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .offset(window.skip)
      .limit(window.pageSize);
    if (query.search) {
      builder.where(`user.email ILIKE :search ESCAPE '\\'`, {
        search: `%${escapeLike(query.search)}%`,
      });
    }
    const [{ entities, raw }, total] = await Promise.all([
      builder.getRawAndEntities<{ kid_count: string }>(),
      builder.getCount(),
    ]);
    const items = entities.map((user, index) =>
      toAdminUserView(user, Number(raw[index]?.kid_count ?? 0)),
    );
    return toPage(items, total, window);
  }

  async view(id: string): Promise<AdminUserView> {
    const user = await this.dataSource
      .getRepository(UserEntity)
      .findOneBy({ id });
    if (!user) {
      throw userNotFound();
    }
    return toAdminUserView(user, await this.kidCount(user.id));
  }

  async update(
    actor: AdminActor,
    id: string,
    dto: UpdateUserDto,
  ): Promise<AdminUserView> {
    const { user, families } = await this.guardrail.mutate(
      id,
      () => dto.role === 'parent' || dto.disabled === true,
      async (manager, current) => {
        const changes = {
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.disabled !== undefined && { disabled: dto.disabled }),
        };
        if (Object.keys(changes).length > 0) {
          await manager.update(UserEntity, { id }, changes);
        }
        const reason = sessionEndReason(current, dto);
        const revoked = reason
          ? await this.sessions.revokeUserSessionsIn(manager, id, reason)
          : [];
        const updated = await manager.findOneByOrFail(UserEntity, { id });
        return { user: updated, families: revoked };
      },
    );
    await this.sessions.markRevoked(families);
    await this.audit.record({
      action: 'admin.user_updated',
      actorId: actor.userId,
      targetType: 'user',
      targetId: user.id,
      ip: actor.ip,
      meta: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.disabled !== undefined && { disabled: dto.disabled }),
      },
    });
    return toAdminUserView(user, await this.kidCount(user.id));
  }

  async delete(actor: AdminActor, id: string): Promise<void> {
    if (id === actor.userId) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'CANNOT_DELETE_SELF',
        'Admins cannot delete their own account here',
      );
    }
    const families = await this.guardrail.mutate(
      id,
      () => true,
      async (manager) => {
        const revoked = await this.sessions.revokeUserSessionsIn(
          manager,
          id,
          'deleted',
        );
        await deleteUserIn(manager, id);
        return revoked;
      },
    );
    await this.sessions.markRevoked(families);
    await this.audit.record({
      action: 'admin.user_deleted',
      actorId: actor.userId,
      targetType: 'user',
      ip: actor.ip,
    });
  }

  recordInvite(
    action: 'admin.invite_created' | 'admin.invite_revoked',
    actor: AdminActor,
    inviteId: string,
    meta?: Record<string, string>,
  ): Promise<void> {
    return this.audit.record({
      action,
      actorId: actor.userId,
      targetType: 'invite',
      targetId: inviteId,
      ip: actor.ip,
      ...(meta && { meta }),
    });
  }

  private async kidCount(userId: string): Promise<number> {
    const [row] = await this.dataSource.query<{ count: number }[]>(
      'SELECT COUNT(*)::int AS "count" FROM "kids" WHERE "user_id" = $1',
      [userId],
    );
    return row.count;
  }
}
