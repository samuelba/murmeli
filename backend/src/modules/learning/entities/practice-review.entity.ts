import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { KidEntity } from '../../kids/kid.entity';
import { REVIEW_DONE_BOX } from '../learning.constants';

@Entity('practice_reviews')
@Index('UQ_practice_reviews_kid_item_key', ['kidId', 'itemKey'], {
  unique: true,
})
@Index('IDX_practice_reviews_kid_topic_due', ['kidId', 'topicId', 'dueAt'])
@Check('CHK_practice_reviews_generator', `"generator" >= 0`)
@Check('CHK_practice_reviews_seed', `"seed" BETWEEN 0 AND 4294967295`)
@Check('CHK_practice_reviews_tier', `"tier" >= 0`)
@Check('CHK_practice_reviews_box', `"box" BETWEEN 0 AND ${REVIEW_DONE_BOX - 1}`)
@Check('CHK_practice_reviews_misses', `"misses" >= 0`)
export class PracticeReviewEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'PK_practice_reviews_id',
  })
  id: string;

  @Column({ name: 'kid_id', type: 'uuid' })
  kidId: string;

  @ManyToOne(() => KidEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'kid_id',
    foreignKeyConstraintName: 'FK_practice_reviews_kid_id',
  })
  kid?: KidEntity;

  @Column({ name: 'topic_id', type: 'text' })
  topicId: string;

  @Column({ type: 'text' })
  locale: string;

  @Column({ name: 'item_key', type: 'text' })
  itemKey: string;

  @Column({ name: 'level_id', type: 'text' })
  levelId: string;

  @Column({ type: 'smallint' })
  generator: number;

  @Column({ type: 'bigint' })
  seed: string;

  @Column({ name: 'source_topic', type: 'text', nullable: true })
  sourceTopic: string | null;

  @Column({ type: 'smallint' })
  tier: number;

  @Column({ type: 'smallint', default: 0 })
  box: number;

  @Column({ type: 'smallint', default: 1 })
  misses: number;

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
