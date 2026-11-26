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

export const EMAIL_TOKEN_TYPES = [
  'registration',
  'password_reset',
  'email_change',
] as const;
export type EmailTokenType = (typeof EMAIL_TOKEN_TYPES)[number];

@Entity('email_tokens')
@Unique('UQ_email_tokens_token_hash', ['tokenHash'])
@Index('UQ_email_tokens_open', ['userId', 'type'], {
  unique: true,
  where: '"used_at" IS NULL',
})
@Index('IDX_email_tokens_user_id', ['userId'])
@Index('IDX_email_tokens_expires_at', ['expiresAt'])
@Check('CHK_email_tokens_type', `"type" IN (${sqlList(EMAIL_TOKEN_TYPES)})`)
@Check(
  'CHK_email_tokens_new_email',
  `("type" = 'email_change') = ("new_email" IS NOT NULL)`,
)
export class EmailTokenEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'PK_email_tokens_id',
  })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_email_tokens_user_id',
  })
  user?: UserEntity;

  @Column({ type: 'text' })
  type: EmailTokenType;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash: string;

  @Column({ name: 'new_email', type: 'citext', nullable: true })
  newEmail: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
