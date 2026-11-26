import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { MAX_ATTEMPTS } from '@murmeli/content';
import { KidEntity } from '../../kids/kid.entity';
import { sqlList } from '../../users/user.types';
import { RUN_MODES, type RunMode } from '../learning.constants';

@Entity('attempts')
@Index('IDX_attempts_kid_created_at', ['kidId', 'createdAt'])
@Index('UQ_attempts_run_item_attempt', ['runId', 'itemIndex', 'attempt'], {
  unique: true,
})
@Check('CHK_attempts_mode', `"mode" IN (${sqlList(RUN_MODES)})`)
@Check('CHK_attempts_level_id', `("mode" = 'practice') = ("level_id" IS NULL)`)
@Check('CHK_attempts_attempt', `"attempt" BETWEEN 1 AND ${MAX_ATTEMPTS}`)
@Check('CHK_attempts_item_index', `"item_index" >= 0`)
@Check('CHK_attempts_duration_ms', `"duration_ms" >= 0`)
export class AttemptEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'PK_attempts_id',
  })
  id: string;

  @Column({ name: 'kid_id', type: 'uuid' })
  kidId: string;

  @ManyToOne(() => KidEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'kid_id',
    foreignKeyConstraintName: 'FK_attempts_kid_id',
  })
  kid?: KidEntity;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @Column({ name: 'level_id', type: 'text', nullable: true })
  levelId: string | null;

  @Column({ name: 'skill_id', type: 'text' })
  skillId: string;

  @Column({ name: 'exercise_type', type: 'text' })
  exerciseType: string;

  @Column({ name: 'item_index', type: 'smallint' })
  itemIndex: number;

  @Column({ type: 'smallint' })
  attempt: number;

  @Column({ type: 'boolean' })
  correct: boolean;

  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs: number;

  @Column({ type: 'text' })
  mode: RunMode;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
