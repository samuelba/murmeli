import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { sqlList } from '../users/user.types';
import {
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
  type AuditAction,
  type AuditMeta,
  type AuditTargetType,
} from './audit.types';

@Entity('audit_log')
@Index('IDX_audit_log_at_id', { synchronize: false })
@Index('IDX_audit_log_action_at_id', { synchronize: false })
@Index('IDX_audit_log_actor_id', ['actorId'])
@Check('CHK_audit_log_action', `"action" IN (${sqlList(AUDIT_ACTIONS)})`)
@Check(
  'CHK_audit_log_target_type',
  `"target_type" IS NULL OR "target_type" IN (${sqlList(AUDIT_TARGET_TYPES)})`,
)
export class AuditLogEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'PK_audit_log_id',
  })
  id: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  at: Date;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'text' })
  action: AuditAction;

  @Column({ name: 'target_type', type: 'text', nullable: true })
  targetType: AuditTargetType | null;

  @Column({ name: 'target_id', type: 'text', nullable: true })
  targetId: string | null;

  @Column({ type: 'text', nullable: true })
  ip: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: AuditMeta | null;
}
