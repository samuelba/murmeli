import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import {
  generateSecureToken,
  sha256Hex,
} from '../../../common/crypto/secure-token';
import { apiError } from '../../../common/errors/api-exception';
import {
  type Page,
  type PaginationQuery,
  pageWindow,
  toPage,
} from '../../../common/pagination/pagination';
import { addSeconds } from '../../../common/time/duration';
import { UserEntity } from '../../users/user.entity';
import type { Locale, Role } from '../../users/user.types';
import { UsersService, isUniqueViolation } from '../../users/users.service';
import { INVITE_TTL_SECONDS } from '../auth.constants';
import { InviteEntity } from '../entities/invite.entity';
import { PasswordService } from '../passwords/password.service';
import { AuthMailer } from '../services/auth-mailer';

export interface InviteView {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export interface InviteDetails {
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: string;
}

export type InviteEmailStatus = 'sent' | 'queued' | 'disabled';

export interface CreatedInvite {
  readonly invite: InviteView;
  readonly inviteUrl: string;
  readonly emailStatus: InviteEmailStatus;
}

const MAX_TOKEN_LENGTH = 128;

export function inviteInvalid() {
  return apiError(
    HttpStatus.NOT_FOUND,
    'INVITE_INVALID',
    'The invitation is invalid or has expired',
  );
}

export function toInviteView(invite: InviteEntity): InviteView {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    createdBy: invite.creator?.email ?? null,
  };
}

/**
 * Admin invitations: a hashed single-use token valid for seven days. The
 * accepted invite counts as email verification.
 */
@Injectable()
export class InviteService {
  constructor(
    @InjectRepository(InviteEntity)
    private readonly invites: Repository<InviteEntity>,
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly mailer: AuthMailer,
  ) {}

  async create(
    email: string,
    role: Role,
    createdBy: string,
    locale: Locale,
  ): Promise<CreatedInvite> {
    if (await this.users.findByEmail(email)) {
      throw apiError(
        HttpStatus.CONFLICT,
        'EMAIL_TAKEN',
        'A user with this email address already exists',
      );
    }
    await this.invites.delete({ email, acceptedAt: IsNull() });
    const { token, hash } = generateSecureToken();
    const inserted = await this.invites.insert({
      email,
      role,
      tokenHash: hash,
      createdBy,
      expiresAt: addSeconds(new Date(), INVITE_TTL_SECONDS),
    });
    const id = (inserted.identifiers[0] as { id: string }).id;
    const invite = await this.invites.findOneOrFail({
      where: { id },
      relations: { creator: true },
    });
    const sent = await this.mailer.invite({ email, locale }, token);
    return {
      invite: toInviteView(invite),
      inviteUrl: this.mailer.inviteUrl(token),
      emailStatus: sent === 'queued' || sent === 'sent' ? sent : 'disabled',
    };
  }

  async list(query: PaginationQuery): Promise<Page<InviteView>> {
    const window = pageWindow(query);
    const [items, total] = await this.invites.findAndCount({
      where: { acceptedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      relations: { creator: true },
      order: { createdAt: 'DESC' },
      skip: window.skip,
      take: window.pageSize,
    });
    return toPage(items.map(toInviteView), total, window);
  }

  async revoke(id: string): Promise<boolean> {
    const result = await this.invites.delete({ id, acceptedAt: IsNull() });
    return (result.affected ?? 0) > 0;
  }

  async details(token: string): Promise<InviteDetails> {
    const invite = await this.findValid(token);
    if (!invite) {
      throw inviteInvalid();
    }
    return {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async accept(
    token: string,
    password: string,
    locale: Locale,
  ): Promise<UserEntity> {
    if (!(await this.findValid(token))) {
      throw inviteInvalid();
    }
    await this.passwords.assertAcceptable(password);
    const passwordHash = await this.passwords.hash(password);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const rows = await manager.query<
          [{ email: string; role: Role }[], number]
        >(
          `UPDATE "invites" SET "accepted_at" = now()
           WHERE "token_hash" = $1 AND "accepted_at" IS NULL AND "expires_at" > now()
           RETURNING "email", "role"`,
          [sha256Hex(token)],
        );
        const [invite] = rows[0];
        if (!invite) {
          throw inviteInvalid();
        }
        return this.users.create(
          {
            email: invite.email,
            passwordHash,
            locale,
            role: invite.role,
            emailVerifiedAt: new Date(),
          },
          manager,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw inviteInvalid();
      }
      throw error;
    }
  }

  private findValid(token: string): Promise<InviteEntity | null> {
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
      return Promise.resolve(null);
    }
    return this.invites.findOneBy({
      tokenHash: sha256Hex(token),
      acceptedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
  }
}
