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
import { UserEntity } from '../users/user.entity';
import { LOCALES, type Locale, sqlList } from '../users/user.types';
import {
  type Avatar,
  BIRTH_YEAR_MAX,
  BIRTH_YEAR_MIN,
  DAILY_LIMIT_MAX,
  DAILY_LIMIT_MIN,
  NICKNAME_MAX_LENGTH,
  READ_ALOUD_MODES,
  type ReadAloud,
  START_CLASSES,
  type StartClass,
} from './kid.types';

@Entity('kids')
@Index('IDX_kids_user_id', ['userId'])
@Check('CHK_kids_nickname_not_blank', `btrim("nickname") <> ''`)
@Check(
  'CHK_kids_nickname_length',
  `char_length("nickname") BETWEEN 1 AND ${NICKNAME_MAX_LENGTH}`,
)
@Check('CHK_kids_start_class', `"start_class" IN (${sqlList(START_CLASSES)})`)
@Check('CHK_kids_language', `"language" IN (${sqlList(LOCALES)})`)
@Check('CHK_kids_read_aloud', `"read_aloud" IN (${sqlList(READ_ALOUD_MODES)})`)
@Check(
  'CHK_kids_birth_year',
  `"birth_year" IS NULL OR "birth_year" BETWEEN ${BIRTH_YEAR_MIN} AND ${BIRTH_YEAR_MAX}`,
)
@Check(
  'CHK_kids_daily_limit_minutes',
  `"daily_limit_minutes" IS NULL OR "daily_limit_minutes" BETWEEN ${DAILY_LIMIT_MIN} AND ${DAILY_LIMIT_MAX}`,
)
export class KidEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'PK_kids_id',
  })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_kids_user_id' })
  user?: UserEntity;

  @Column({ type: 'text' })
  nickname: string;

  @Column({ type: 'jsonb' })
  avatar: Avatar;

  @Column({ name: 'start_class', type: 'text' })
  startClass: StartClass;

  @Column({ name: 'birth_year', type: 'smallint', nullable: true })
  birthYear: number | null;

  @Column({ type: 'text' })
  language: Locale;

  @Column({ name: 'pin_hash', type: 'text', nullable: true })
  pinHash: string | null;

  @Column({ name: 'daily_limit_minutes', type: 'smallint', nullable: true })
  dailyLimitMinutes: number | null;

  @Column({ name: 'sound_enabled', type: 'boolean', default: true })
  soundEnabled: boolean;

  @Column({ name: 'read_aloud', type: 'text', default: 'auto' })
  readAloud: ReadAloud;

  @Column({ name: 'last_active_at', type: 'timestamptz', nullable: true })
  lastActiveAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
