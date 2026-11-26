import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  LOCALES,
  type Locale,
  ROLES,
  type Role,
  THEMES,
  type Theme,
  sqlList,
} from './user.types';

@Entity('users')
@Unique('UQ_users_email', ['email'])
@Index('IDX_users_active_admins', ['id'], {
  where: `"role" = 'admin' AND "disabled" = false`,
})
@Check('CHK_users_role', `"role" IN (${sqlList(ROLES)})`)
@Check('CHK_users_locale', `"locale" IN (${sqlList(LOCALES)})`)
@Check('CHK_users_theme', `"theme" IS NULL OR "theme" IN (${sqlList(THEMES)})`)
export class UserEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'PK_users_id',
  })
  id: string;

  @Column({ type: 'citext' })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ type: 'text', default: 'parent' })
  role: Role;

  @Column({ type: 'text', default: 'de-CH' })
  locale: Locale;

  @Column({ type: 'text', nullable: true })
  theme: Theme | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'totp_enabled', type: 'boolean', default: false })
  totpEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  disabled: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
