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
import { ROLES, type Role, sqlList } from '../../users/user.types';

@Entity('invites')
@Unique('UQ_invites_token_hash', ['tokenHash'])
@Index('UQ_invites_pending_email', ['email'], {
  unique: true,
  where: '"accepted_at" IS NULL',
})
@Index('IDX_invites_created_by', ['createdBy'])
@Index('IDX_invites_expires_at', ['expiresAt'])
@Check('CHK_invites_role', `"role" IN (${sqlList(ROLES)})`)
export class InviteEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'PK_invites_id',
  })
  id: string;

  @Column({ type: 'citext' })
  email: string;

  @Column({ type: 'text', default: 'parent' })
  role: Role;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'FK_invites_created_by',
  })
  creator?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
