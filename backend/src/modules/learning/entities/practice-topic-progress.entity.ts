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

@Entity('practice_topic_progress')
@Check('CHK_practice_topic_progress_rating', `"rating" >= 0 AND "rating" < 100`)
@Check('CHK_practice_topic_progress_path_step', `"path_step" >= -1`)
@Check('CHK_practice_topic_progress_runs', `"runs" >= 0`)
@Check(
  'CHK_practice_topic_progress_first_try',
  `"first_try" BETWEEN 0 AND "items"`,
)
@Check('CHK_practice_topic_progress_accuracy', `"accuracy" BETWEEN 0 AND 1`)
export class PracticeTopicProgressEntity {
  @PrimaryColumn({
    name: 'kid_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_practice_topic_progress',
  })
  kidId: string;

  @PrimaryColumn({
    name: 'topic_id',
    type: 'text',
    primaryKeyConstraintName: 'PK_practice_topic_progress',
  })
  topicId: string;

  @ManyToOne(() => KidEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'kid_id',
    foreignKeyConstraintName: 'FK_practice_topic_progress_kid_id',
  })
  kid?: KidEntity;

  @Column({ type: 'double precision' })
  rating: number;

  @Column({ name: 'path_step', type: 'smallint', default: -1 })
  pathStep: number;

  @Column({ type: 'integer', default: 0 })
  runs: number;

  @Column({ type: 'integer', default: 0 })
  items: number;

  @Column({ name: 'first_try', type: 'integer', default: 0 })
  firstTry: number;

  @Column({ type: 'double precision', nullable: true })
  accuracy: number | null;

  @Column({ name: 'demo_seen_at', type: 'timestamptz', nullable: true })
  demoSeenAt: Date | null;

  @Column({ name: 'last_practiced_at', type: 'timestamptz', nullable: true })
  lastPracticedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
