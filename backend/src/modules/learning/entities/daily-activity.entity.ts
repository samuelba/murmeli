import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { KidEntity } from '../../kids/kid.entity';
import { SECONDS_PER_DAY } from '../learning.constants';

@Entity('daily_activity')
@Check(
  'CHK_daily_activity_seconds',
  `"seconds" BETWEEN 0 AND ${SECONDS_PER_DAY}`,
)
@Check('CHK_daily_activity_runs', `"runs" >= 0`)
export class DailyActivityEntity {
  @PrimaryColumn({
    name: 'kid_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_daily_activity',
  })
  kidId: string;

  @PrimaryColumn({
    type: 'date',
    primaryKeyConstraintName: 'PK_daily_activity',
  })
  day: string;

  @ManyToOne(() => KidEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'kid_id',
    foreignKeyConstraintName: 'FK_daily_activity_kid_id',
  })
  kid?: KidEntity;

  @Column({ type: 'integer', default: 0 })
  seconds: number;

  @Column({ type: 'integer', default: 0 })
  runs: number;
}
