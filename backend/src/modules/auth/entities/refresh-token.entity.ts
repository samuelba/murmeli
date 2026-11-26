import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../../users/user.entity';
import { sqlList } from '../../users/user.types';

export const REVOCATION_REASONS = [
  'rotated',
  'logout',
  'compromised',
  'password_changed',
  'password_reset',
  'email_changed',
  'disabled',
  'role_changed',
  'deleted',
] as const;
export type RevocationReason = (typeof REVOCATION_REASONS)[number];

@Entity('refresh_tokens')
@Unique('UQ_refresh_tokens_token_hash', ['tokenHash'])
@Index('IDX_refresh_tokens_active_family', { synchronize: false })
@Index('IDX_refresh_tokens_active_user', ['userId', 'familyId'], {
  where: '"revoked" = false',
})
@Index('IDX_refresh_tokens_user_id', ['userId'])
@Index('IDX_refresh_tokens_expires_at', ['expiresAt'])
@Check(
  'CHK_refresh_tokens_user_agent_length',
  `char_length("user_agent") <= 200`,
)
@Check(
  'CHK_refresh_tokens_revoked_reason',
  `"revoked_reason" IS NULL OR "revoked_reason" IN (${sqlList(REVOCATION_REASONS)})`,
)
export class RefreshTokenEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'PK_refresh_tokens_id',
  })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_refresh_tokens_user_id',
  })
  user?: UserEntity;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash: string;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ name: 'revoked_reason', type: 'text', nullable: true })
  revokedReason: RevocationReason | null;

  @Column({ name: 'replaced_by', type: 'uuid', nullable: true })
  replacedBy: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
