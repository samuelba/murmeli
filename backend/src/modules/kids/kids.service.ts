import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { apiError } from '../../common/errors/api-exception';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/passwords/password.service';
import { KidEntity } from './kid.entity';
import type { CreateKidDto, UpdateKidDto } from './kid.dto';
import { MAX_KIDS_PER_USER, type KidView } from './kid.types';
import { toKidView } from './kid.view';
import { canonicalAvatar } from './avatar';
import type { Avatar } from './kid.types';

export interface KidActor {
  readonly userId: string;
  readonly ip: string | null;
}

export function kidNotFound() {
  return apiError(HttpStatus.NOT_FOUND, 'KID_NOT_FOUND', 'Kid not found');
}

export function pinToSecret(pin: readonly number[]): string {
  return pin.join('-');
}

function validAvatar(avatar: Avatar): Avatar {
  const canonical = canonicalAvatar(avatar);
  if (!canonical) {
    throw apiError(HttpStatus.BAD_REQUEST, 'AVATAR_INVALID', 'Unknown avatar');
  }
  return canonical;
}

type KidChanges = Partial<
  Omit<KidEntity, 'id' | 'userId' | 'user' | 'createdAt' | 'updatedAt'>
>;

/**
 * Kid profiles. They hold only a nickname, an avatar, a class or birth year
 * and settings; nicknames never reach logs or the audit log.
 */
@Injectable()
export class KidsService {
  constructor(
    @InjectRepository(KidEntity)
    private readonly kids: Repository<KidEntity>,
    private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string): Promise<KidView[]> {
    const kids = await this.kids.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return kids.map(toKidView);
  }

  async findOwned(userId: string, kidId: string): Promise<KidEntity | null> {
    return isUUID(kidId) ? this.kids.findOneBy({ id: kidId, userId }) : null;
  }

  async requireOwned(userId: string, kidId: string): Promise<KidEntity> {
    const kid = await this.findOwned(userId, kidId);
    if (!kid) {
      throw kidNotFound();
    }
    return kid;
  }

  async create(actor: KidActor, dto: CreateKidDto): Promise<KidView> {
    const avatar = validAvatar(dto.avatar);
    const pinHash = dto.pin
      ? await this.passwords.hash(pinToSecret(dto.pin))
      : null;
    const kid = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT 1 FROM "users" WHERE "id" = $1 FOR UPDATE', [
        actor.userId,
      ]);
      const count = await manager.countBy(KidEntity, { userId: actor.userId });
      if (count >= MAX_KIDS_PER_USER) {
        throw apiError(
          HttpStatus.BAD_REQUEST,
          'KID_LIMIT',
          `At most ${MAX_KIDS_PER_USER} kids per account`,
        );
      }
      const repository = manager.getRepository(KidEntity);
      return repository.save(
        repository.create({
          userId: actor.userId,
          nickname: dto.nickname,
          avatar,
          startClass: dto.startClass,
          birthYear: dto.birthYear ?? null,
          language: dto.language,
          pinHash,
          dailyLimitMinutes: dto.dailyLimitMinutes ?? null,
          soundEnabled: dto.soundEnabled ?? true,
          readAloud: dto.readAloud ?? 'auto',
        }),
      );
    });
    await this.recordAudit('kid.created', actor, kid.id);
    return toKidView(kid);
  }

  async update(
    userId: string,
    kidId: string,
    dto: UpdateKidDto,
  ): Promise<KidView> {
    const kid = await this.requireOwned(userId, kidId);
    const changes = await this.changesFrom(dto);
    if (Object.keys(changes).length > 0) {
      await this.kids.update({ id: kid.id }, changes);
    }
    return toKidView(await this.kids.findOneByOrFail({ id: kid.id }));
  }

  async remove(actor: KidActor, kidId: string): Promise<void> {
    const kid = await this.requireOwned(actor.userId, kidId);
    await this.kids.delete({ id: kid.id });
    await this.recordAudit('kid.deleted', actor, kid.id);
  }

  /**
   * Records activity at most once a minute per kid.
   */
  async markActive(kidId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "kids" SET "last_active_at" = now()
       WHERE "id" = $1
         AND ("last_active_at" IS NULL OR "last_active_at" < now() - interval '60 seconds')`,
      [kidId],
    );
  }

  private async changesFrom(dto: UpdateKidDto): Promise<KidChanges> {
    const pinHash =
      dto.pin === undefined
        ? undefined
        : dto.pin === null
          ? null
          : await this.passwords.hash(pinToSecret(dto.pin));
    const entries: [keyof KidChanges, unknown][] = [
      ['nickname', dto.nickname],
      ['avatar', dto.avatar && validAvatar(dto.avatar)],
      ['startClass', dto.startClass],
      ['birthYear', dto.birthYear],
      ['language', dto.language],
      ['pinHash', pinHash],
      ['dailyLimitMinutes', dto.dailyLimitMinutes],
      ['soundEnabled', dto.soundEnabled],
      ['readAloud', dto.readAloud],
    ];
    return Object.fromEntries(
      entries.filter(([, value]) => value !== undefined),
    );
  }

  private recordAudit(
    action: 'kid.created' | 'kid.deleted',
    actor: KidActor,
    kidId: string,
  ): Promise<void> {
    return this.audit.record({
      action,
      actorId: actor.userId,
      targetType: 'kid',
      targetId: kidId,
      ip: actor.ip,
    });
  }
}
