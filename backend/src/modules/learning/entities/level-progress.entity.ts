import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { KidEntity } from '../../kids/kid.entity';

@Entity('level_progress')
@Check('CHK_level_progress_stars', `"stars" BETWEEN 0 AND 3`)
@Check('CHK_level_progress_best_score', `"best_score" BETWEEN 0 AND 1`)
@Check('CHK_level_progress_runs', `"runs" >= 0`)
@Check('CHK_level_progress_passed', `"first_passed_at" IS NULL OR "stars" >= 2`)
export class LevelProgressEntity {
  @PrimaryColumn({
    name: 'kid_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_level_progress',
  })
  kidId: string;

  @PrimaryColumn({
    name: 'level_id',
    type: 'text',
    primaryKeyConstraintName: 'PK_level_progress',
  })
  levelId: string;

  @ManyToOne(() => KidEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'kid_id',
    foreignKeyConstraintName: 'FK_level_progress_kid_id',
  })
  kid?: KidEntity;

  @Column({ type: 'smallint', default: 0 })
  stars: number;

  @Column({ name: 'best_score', type: 'double precision', default: 0 })
  bestScore: number;

  @Column({ type: 'integer', default: 0 })
  runs: number;

  @Column({ name: 'first_passed_at', type: 'timestamptz', nullable: true })
  firstPassedAt: Date | null;

  @Column({ name: 'demo_seen_at', type: 'timestamptz', nullable: true })
  demoSeenAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
