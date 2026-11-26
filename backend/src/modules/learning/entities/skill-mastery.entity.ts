import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { KidEntity } from '../../kids/kid.entity';
import { LEITNER_MAX_BOX } from '../learning.constants';

@Entity('skill_mastery')
@Index('IDX_skill_mastery_kid_next_review', ['kidId', 'nextReviewAt'])
@Check('CHK_skill_mastery_mastery', `"mastery" BETWEEN 0 AND 1`)
@Check('CHK_skill_mastery_box', `"box" BETWEEN 1 AND ${LEITNER_MAX_BOX}`)
export class SkillMasteryEntity {
  @PrimaryColumn({
    name: 'kid_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_skill_mastery',
  })
  kidId: string;

  @PrimaryColumn({
    name: 'skill_id',
    type: 'text',
    primaryKeyConstraintName: 'PK_skill_mastery',
  })
  skillId: string;

  @ManyToOne(() => KidEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'kid_id',
    foreignKeyConstraintName: 'FK_skill_mastery_kid_id',
  })
  kid?: KidEntity;

  @Column({ type: 'double precision' })
  mastery: number;

  @Column({ type: 'smallint' })
  box: number;

  @Column({ name: 'next_review_at', type: 'timestamptz' })
  nextReviewAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
