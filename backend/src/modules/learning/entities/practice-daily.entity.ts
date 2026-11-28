import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { KidEntity } from '../../kids/kid.entity';

@Entity('practice_daily')
@Index('IDX_practice_daily_kid_day', ['kidId', 'day'])
@Check('CHK_practice_daily_first_try', `"first_try" BETWEEN 0 AND "items"`)
export class PracticeDailyEntity {
  @PrimaryColumn({
    name: 'kid_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_practice_daily',
  })
  kidId: string;

  @PrimaryColumn({
    name: 'topic_id',
    type: 'text',
    primaryKeyConstraintName: 'PK_practice_daily',
  })
  topicId: string;

  @PrimaryColumn({
    type: 'date',
    primaryKeyConstraintName: 'PK_practice_daily',
  })
  day: string;

  @ManyToOne(() => KidEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'kid_id',
    foreignKeyConstraintName: 'FK_practice_daily_kid_id',
  })
  kid?: KidEntity;

  @Column({ type: 'integer', default: 0 })
  items: number;

  @Column({ name: 'first_try', type: 'integer', default: 0 })
  firstTry: number;
}
