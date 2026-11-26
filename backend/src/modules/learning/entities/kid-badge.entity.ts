import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { KidEntity } from '../../kids/kid.entity';

@Entity('kid_badges')
export class KidBadgeEntity {
  @PrimaryColumn({
    name: 'kid_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_kid_badges',
  })
  kidId: string;

  @PrimaryColumn({
    name: 'badge_id',
    type: 'text',
    primaryKeyConstraintName: 'PK_kid_badges',
  })
  badgeId: string;

  @ManyToOne(() => KidEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'kid_id',
    foreignKeyConstraintName: 'FK_kid_badges_kid_id',
  })
  kid?: KidEntity;

  @CreateDateColumn({ name: 'earned_at', type: 'timestamptz' })
  earnedAt: Date;
}
